"""AI MLOps Assistant Engine for AutoMLOps.

Builds a grounded context payload from real project data (leaderboard,
SHAP feature importances, cleaning reports, dataset stats) and uses it
to answer user questions via Google Gemini 2.5 Flash.

IMPORTANT — Grounding Contract:
    The Gemini prompt explicitly instructs the model to ONLY reference
    numbers and facts present in the injected context. The fallback
    template engine also draws exclusively from the same context dict.
    Any future changes MUST preserve this invariant so that the
    assistant never states a metric that isn't in the context payload.
"""
import os
import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.project import Project
from app.models.dataset import Dataset
from app.models.analysis import AnalysisReport
from app.models.cleaning import CleaningHistory
from app.models.trained_model import TrainedModel
from app.models.explanation import ExplanationReport
from app.config import settings


# ──────────────────────────────────────────────
# 1. Context Builder
# ──────────────────────────────────────────────

def _model_rank_key(m: TrainedModel):
    """Rank models by valid path first, then primary metric (matches training.py)."""
    metrics = m.metrics or {}
    has_valid_path = 1 if (m.model_path and len(m.model_path) > 0) else 0
    score = metrics.get('accuracy', metrics.get('r2', metrics.get('cv_score', 0)))
    if not isinstance(score, (int, float)):
        score = 0
    return (has_valid_path, score)


async def build_context_payload(db: AsyncSession, project_id: str) -> dict:
    """Pull together all available project data into a single context dict.

    This dict is injected verbatim into the Gemini prompt so that every
    number the assistant references is traceable to a real computation.
    """
    ctx: dict[str, Any] = {
        'project': {},
        'dataset': {},
        'analysis': {},
        'cleaning': {},
        'leaderboard': [],
        'best_model': {},
        'feature_importance': {},
    }

    # ── Project ──
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if project:
        ctx['project'] = {
            'name': project.name,
            'task_type': project.task_type or 'unknown',
            'target_column': project.target_column or 'unknown',
            'status': project.status or 'unknown',
        }

    # ── Dataset ──
    ds_res = await db.execute(
        select(Dataset)
        .filter(Dataset.project_id == project_id)
        .order_by(Dataset.uploaded_at.desc())
    )
    dataset = ds_res.scalars().first()
    if dataset:
        ctx['dataset'] = {
            'filename': dataset.filename,
            'row_count': dataset.row_count,
            'column_count': dataset.column_count,
            'file_type': dataset.file_type,
            'status': dataset.status,
        }

        # ── Analysis Report ──
        ar_res = await db.execute(
            select(AnalysisReport).filter(AnalysisReport.dataset_id == dataset.id)
        )
        analysis = ar_res.scalars().first()
        if analysis:
            missing_summary = {}
            if analysis.missing_values and '__summary__' in analysis.missing_values:
                missing_summary = analysis.missing_values['__summary__']

            # Summarise outliers: count columns with outliers
            outlier_cols = 0
            total_outlier_values = 0
            if analysis.outliers:
                for col, info in analysis.outliers.items():
                    if isinstance(info, dict) and info.get('iqr_outliers', 0) > 0:
                        outlier_cols += 1
                        total_outlier_values += info['iqr_outliers']

            ctx['analysis'] = {
                'data_types': analysis.data_types or {},
                'missing_values_summary': missing_summary,
                'outlier_columns_count': outlier_cols,
                'total_outlier_values': total_outlier_values,
                'class_balance': analysis.class_balance or {},
                'high_correlations': (analysis.correlations or {}).get('high_correlations', [])[:5],
            }

        # ── Cleaning History ──
        ch_res = await db.execute(
            select(CleaningHistory)
            .filter(CleaningHistory.dataset_id == dataset.id)
            .order_by(CleaningHistory.created_at.desc())
        )
        cleaning = ch_res.scalars().first()
        if cleaning:
            ctx['cleaning'] = {
                'steps_applied': cleaning.steps_applied or [],
                'rows_before': cleaning.rows_before,
                'rows_after': cleaning.rows_after,
                'columns_before': cleaning.columns_before,
                'columns_after': cleaning.columns_after,
            }

    # ── Leaderboard ──
    tm_res = await db.execute(
        select(TrainedModel).filter(TrainedModel.project_id == project_id)
    )
    models = list(tm_res.scalars().all())
    models.sort(key=_model_rank_key, reverse=True)

    leaderboard = []
    best_model_info: dict[str, Any] = {}
    for i, m in enumerate(models):
        entry = {
            'rank': i + 1,
            'algorithm': m.algorithm,
            'metrics': m.metrics or {},
            'training_time_seconds': round(m.training_time_seconds, 2) if m.training_time_seconds else 0,
            'is_selected': bool(m.is_selected),
        }
        leaderboard.append(entry)
        if i == 0:
            best_model_info = {
                'algorithm': m.algorithm,
                'metrics': m.metrics or {},
                'model_id': m.id,
            }
    ctx['leaderboard'] = leaderboard
    ctx['best_model'] = best_model_info

    # ── Feature Importance (from best model's explanation) ──
    if best_model_info.get('model_id'):
        exp_res = await db.execute(
            select(ExplanationReport)
            .filter(ExplanationReport.model_id == best_model_info['model_id'])
        )
        explanation = exp_res.scalars().first()
        if explanation and explanation.feature_importance:
            # Keep top 10 features for context (keeps prompt lean)
            top_features = dict(
                list(explanation.feature_importance.items())[:10]
            )
            ctx['feature_importance'] = top_features

    return ctx


# ──────────────────────────────────────────────
# 2. Gemini API Caller
# ──────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an expert MLOps assistant for the AutoMLOps platform.
You help users understand their machine learning project results in plain English.

CRITICAL RULES:
1. ONLY reference numbers, metrics, model names, and feature names that appear in the CONTEXT below.
2. NEVER invent, estimate, or hallucinate any metric value.
3. If the context does not contain enough information to answer, say so honestly.
4. Keep answers concise (2-4 paragraphs max) and actionable.
5. Use the exact metric values from the context when quoting numbers.

CONTEXT (real computed data from the user's project):
{context_json}
"""


def ask_gemini(context_payload: dict, user_question: str) -> str:
    """Call Google Gemini 2.5 Flash with the grounded context.

    Raises on any failure — the caller is expected to catch and fall back.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    from google import genai

    client = genai.Client(api_key=api_key)

    context_json = json.dumps(context_payload, indent=2, default=str)
    system_prompt = _SYSTEM_PROMPT.format(context_json=context_json)

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            {"role": "user", "parts": [{"text": system_prompt + "\n\nUser question: " + user_question}]},
        ],
    )

    return response.text


# ──────────────────────────────────────────────
# 3. Deterministic Fallback
# ──────────────────────────────────────────────

def generate_fallback_answer(context_payload: dict, user_question: str) -> str:
    """Produce a deterministic, template-based answer from the context.

    This function is the safety net for live demos — it MUST never throw.
    """
    try:
        q = user_question.lower()
        best = context_payload.get('best_model', {})
        metrics = best.get('metrics', {})
        algo = best.get('algorithm', 'N/A')
        fi = context_payload.get('feature_importance', {})
        top_features = list(fi.keys())[:3] if fi else []
        dataset = context_payload.get('dataset', {})
        cleaning = context_payload.get('cleaning', {})
        analysis = context_payload.get('analysis', {})
        project = context_payload.get('project', {})
        task_type = project.get('task_type', 'unknown')
        leaderboard = context_payload.get('leaderboard', [])

        # Format primary metric
        if task_type == 'classification':
            primary_metric_name = 'accuracy'
            primary_metric_val = metrics.get('accuracy', metrics.get('f1', 'N/A'))
        else:
            primary_metric_name = 'R²'
            primary_metric_val = metrics.get('r2', metrics.get('rmse', 'N/A'))

        if isinstance(primary_metric_val, float):
            primary_metric_val = round(primary_metric_val, 4)

        # ── Keyword-based routing ──
        if any(kw in q for kw in ['best model', 'top model', 'winner', 'selected model', 'which model']):
            answer = f"Your best-performing model is **{algo}** with {primary_metric_name} = {primary_metric_val}."
            if top_features:
                answer += f" The top predictive features are: {', '.join(top_features)}."
            if len(leaderboard) > 1:
                runner_up = leaderboard[1]
                answer += f" The runner-up is {runner_up['algorithm']}."
            return answer

        if any(kw in q for kw in ['feature', 'importance', 'shap', 'driving', 'influential']):
            if top_features:
                parts = []
                for fname in top_features:
                    val = fi.get(fname)
                    if isinstance(val, float):
                        parts.append(f"{fname} (importance: {round(val, 4)})")
                    else:
                        parts.append(fname)
                return f"The most important features for your {algo} model are: {', '.join(parts)}. These features have the highest SHAP values, meaning they contribute most to the model's predictions."
            return "Feature importance data is not yet available. Please run the Explain step on your trained model first."

        if any(kw in q for kw in ['clean', 'preprocess', 'missing', 'outlier']):
            if cleaning:
                steps = cleaning.get('steps_applied', [])
                step_names = [s.get('step_name', s.get('type', 'unknown')) if isinstance(s, dict) else str(s) for s in steps]
                return (
                    f"During data cleaning, {len(steps)} operations were applied: {', '.join(step_names)}. "
                    f"The dataset went from {cleaning.get('rows_before', '?')} rows / {cleaning.get('columns_before', '?')} columns "
                    f"to {cleaning.get('rows_after', '?')} rows / {cleaning.get('columns_after', '?')} columns."
                )
            return "No cleaning history is available yet. Please run the Data Cleaning step first."

        if any(kw in q for kw in ['dataset', 'data size', 'rows', 'columns', 'shape']):
            if dataset:
                return (
                    f"Your dataset '{dataset.get('filename', 'N/A')}' has "
                    f"{dataset.get('row_count', '?')} rows and {dataset.get('column_count', '?')} columns "
                    f"(format: {dataset.get('file_type', '?')})."
                )
            return "No dataset has been uploaded to this project yet."

        if any(kw in q for kw in ['imbalance', 'balanced', 'class distribution', 'class balance']):
            cb = analysis.get('class_balance', {})
            if cb:
                classes = cb.get('classes', {})
                ratio = cb.get('imbalance_ratio', 'N/A')
                is_imb = cb.get('is_imbalanced', False)
                class_info = ', '.join(f"{k}: {v.get('percentage', '?')}%" for k, v in classes.items()) if classes else 'N/A'
                status = "**imbalanced**" if is_imb else "**balanced**"
                return f"Your target variable distribution is {status} (imbalance ratio: {ratio}). Class breakdown: {class_info}."
            return "Class balance information is not available. Please run Dataset Analysis first."

        if any(kw in q for kw in ['recall', 'precision', 'f1', 'accuracy', 'rmse', 'r2', 'metric']):
            if metrics:
                metric_lines = ', '.join(f"{k} = {round(v, 4) if isinstance(v, float) else v}" for k, v in metrics.items())
                return f"Metrics for the best model ({algo}): {metric_lines}."
            return "No trained models with metrics are available yet. Please run AutoML Training first."

        if any(kw in q for kw in ['compare', 'leaderboard', 'all models', 'ranking']):
            if leaderboard:
                lines = []
                for entry in leaderboard:
                    m = entry['metrics']
                    key_metric = m.get('accuracy', m.get('r2', m.get('cv_score', 'N/A')))
                    if isinstance(key_metric, float):
                        key_metric = round(key_metric, 4)
                    lines.append(f"#{entry['rank']} {entry['algorithm']} — {primary_metric_name}: {key_metric}")
                return "Model leaderboard:\n" + '\n'.join(lines)
            return "No models have been trained yet. Please run AutoML Training first."

        if any(kw in q for kw in ['outperform', 'why', 'better', 'worse']):
            if leaderboard and len(leaderboard) >= 2:
                best_entry = leaderboard[0]
                worst_entry = leaderboard[-1]
                return (
                    f"{best_entry['algorithm']} (rank #1) outperformed the others likely due to its ability to capture "
                    f"complex feature interactions. Its {primary_metric_name} is {primary_metric_val}, "
                    f"while the lowest-ranked model ({worst_entry['algorithm']}) achieved "
                    f"{worst_entry['metrics'].get(primary_metric_name, 'N/A')}. "
                    f"The top features driving predictions are: {', '.join(top_features) if top_features else 'not yet computed'}."
                )
            if best:
                return f"Your best model is {algo} with {primary_metric_name} = {primary_metric_val}."
            return "Not enough models to compare. Please train models first."

        # ── Default summary ──
        answer = f"Here's a summary of your project:\n"
        if algo != 'N/A':
            answer += f"• Best model: {algo} ({primary_metric_name} = {primary_metric_val})\n"
        if top_features:
            answer += f"• Top features: {', '.join(top_features)}\n"
        if dataset:
            answer += f"• Dataset: {dataset.get('filename', '?')} ({dataset.get('row_count', '?')} rows × {dataset.get('column_count', '?')} cols)\n"
        if task_type != 'unknown':
            answer += f"• Task type: {task_type}\n"
        answer += "\nFeel free to ask about specific metrics, feature importance, data cleaning, or model comparisons."
        return answer

    except Exception:
        # Last-resort fallback — must NEVER throw
        return (
            "I can provide information about your project's models, features, "
            "and data quality. Please try asking about your best model, "
            "feature importance, or dataset statistics."
        )


# ──────────────────────────────────────────────
# 4. Dynamic Suggestions
# ──────────────────────────────────────────────

def generate_suggestions(context_payload: dict) -> list[str]:
    """Generate 3-4 contextual question suggestions based on actual project data."""
    try:
        suggestions = []
        best = context_payload.get('best_model', {})
        algo = best.get('algorithm')
        leaderboard = context_payload.get('leaderboard', [])
        fi = context_payload.get('feature_importance', {})
        analysis = context_payload.get('analysis', {})
        cleaning = context_payload.get('cleaning', {})
        project = context_payload.get('project', {})
        target = project.get('target_column', 'target')

        if algo and len(leaderboard) > 1:
            suggestions.append(f"Why did {algo} outperform the other models?")

        if fi:
            top_feat = list(fi.keys())[0]
            suggestions.append(f"What makes '{top_feat}' the most important feature?")

        cb = analysis.get('class_balance', {})
        if cb.get('is_imbalanced'):
            suggestions.append(f"My target '{target}' is imbalanced — how does that affect results?")
        elif cb:
            suggestions.append(f"Is my dataset balanced for '{target}'?")

        if best.get('metrics'):
            metrics = best['metrics']
            if metrics.get('recall') is not None and isinstance(metrics.get('recall'), (int, float)):
                if metrics['recall'] < 0.7:
                    suggestions.append("What's causing the low recall and how can I improve it?")
                else:
                    suggestions.append("How can I further improve model performance?")
            elif metrics.get('r2') is not None and isinstance(metrics.get('r2'), (int, float)):
                suggestions.append(f"Is an R² of {round(metrics['r2'], 3)} good for this problem?")
            else:
                suggestions.append("How can I improve model performance?")

        if cleaning:
            suggestions.append("Summarize what data cleaning was applied and its impact.")

        # Cap at 4
        return suggestions[:4]

    except Exception:
        return [
            "What is my best model and how does it perform?",
            "Which features are most important?",
            "Is my dataset balanced?",
            "Summarize the data cleaning steps.",
        ]
