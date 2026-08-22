from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.assistant import AssistantQuestion, AssistantResponse, SuggestionsResponse
from app.engines.mlops_assistant import (
    build_context_payload,
    ask_gemini,
    generate_fallback_answer,
    generate_suggestions,
)

router = APIRouter(tags=["assistant"])


def _build_grounded_summary(context_payload: dict) -> dict:
    """Extract a concise grounded-context summary for the response.

    This is echoed back to the frontend so it can display
    "based on: RandomForest, accuracy=0.92, top feature: income".
    """
    best = context_payload.get('best_model', {})
    fi = context_payload.get('feature_importance', {})
    top_features = list(fi.keys())[:3] if fi else []
    dataset = context_payload.get('dataset', {})
    project = context_payload.get('project', {})

    return {
        'best_model': best.get('algorithm'),
        'task_type': project.get('task_type'),
        'primary_metrics': {
            k: round(v, 4) if isinstance(v, float) else v
            for k, v in (best.get('metrics') or {}).items()
        },
        'top_features': top_features,
        'dataset_shape': f"{dataset.get('row_count', '?')} × {dataset.get('column_count', '?')}",
    }


@router.post("/projects/{project_id}/assistant/ask", response_model=AssistantResponse)
async def ask_assistant(
    project_id: str,
    body: AssistantQuestion,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ask the AI MLOps assistant a question grounded in real project data.

    Tries Gemini 2.5 Flash first; on any failure (missing key, timeout,
    rate limit, network error) falls back to a deterministic template.
    The fallback NEVER throws — it is the safety net for live demos.
    """
    context = await build_context_payload(db, project_id)
    grounded = _build_grounded_summary(context)

    # Try Gemini first
    try:
        answer = ask_gemini(context, body.question)
        return AssistantResponse(
            answer=answer,
            source="gemini",
            grounded_context=grounded,
        )
    except Exception:
        # Fallback to deterministic template — guaranteed to succeed
        answer = generate_fallback_answer(context, body.question)
        return AssistantResponse(
            answer=answer,
            source="fallback",
            grounded_context=grounded,
        )


@router.get("/projects/{project_id}/assistant/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return 3-4 suggested questions relevant to the project's actual results."""
    context = await build_context_payload(db, project_id)
    suggestions = generate_suggestions(context)
    return SuggestionsResponse(suggestions=suggestions)
