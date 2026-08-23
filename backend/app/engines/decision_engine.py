import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, List, Optional
import uuid

def generate_decision_report(df: pd.DataFrame, dataset_name: str, task_type: str = "classification", target_col: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyzes dataset properties and produces explainable recommendations across:
    1. Preprocessing Strategy
    2. Model Selection & Architecture
    3. Deployment Infrastructure & Sizing
    4. Monitoring & Drift Detection Policy
    """
    row_count, col_count = df.shape
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    if target_col and target_col in numeric_cols:
        numeric_cols.remove(target_col)
    if target_col and target_col in categorical_cols:
        categorical_cols.remove(target_col)

    # 1. Missingness Analysis
    missing_counts = df.isnull().sum()
    total_missing = int(missing_counts.sum())
    missing_cols = missing_counts[missing_counts > 0].to_dict()
    missing_ratio = float(total_missing / (row_count * col_count)) if row_count * col_count > 0 else 0.0

    # 2. Outlier Analysis
    outlier_cols = []
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) > 10:
            q25, q75 = np.percentile(series, [25, 75])
            iqr = q75 - q25
            if iqr > 0:
                outliers = series[(series < q25 - 1.5 * iqr) | (series > q75 + 1.5 * iqr)]
                if len(outliers) > 0.03 * len(series):
                    outlier_cols.append(col)

    # 3. High Cardinality & Categoricals
    high_cardinality_cols = [c for c in categorical_cols if df[c].nunique() > 15]
    low_cardinality_cols = [c for c in categorical_cols if df[c].nunique() <= 15]

    # 4. Multicollinearity / Correlation
    high_corr_pairs = []
    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr().abs()
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                val = corr_matrix.iloc[i, j]
                if not np.isnan(val) and val > 0.85:
                    high_corr_pairs.append((numeric_cols[i], numeric_cols[j], round(float(val), 2)))

    # 5. Target Analysis (if specified or defaulted)
    target = target_col if (target_col and target_col in df.columns) else (df.columns[-1] if len(df.columns) > 0 else None)
    is_imbalanced = False
    imbalance_ratio = 1.0
    if target and task_type == 'classification':
        counts = df[target].value_counts(normalize=True)
        if len(counts) > 1:
            imbalance_ratio = float(counts.min())
            if imbalance_ratio < 0.20:
                is_imbalanced = True

    # 6. Sample-to-Feature Ratio
    n_features = max(1, col_count - 1)
    sample_feature_ratio = row_count / n_features
    is_sparse_sample = sample_feature_ratio < 50

    recommendations: List[Dict[str, Any]] = []

    # ==================== A. PREPROCESSING RECOMMENDATIONS ====================
    if total_missing > 0:
        high_missing_cols = [k for k, v in missing_cols.items() if v / row_count > 0.4]
        if high_missing_cols:
            recommendations.append({
                "id": str(uuid.uuid4())[:8],
                "category": "preprocessing",
                "title": f"Drop High-Missingness Columns ({len(high_missing_cols)} detected)",
                "action": f"Remove {', '.join(high_missing_cols[:3])} (>40% missing values)",
                "confidence_score": 0.94,
                "reasoning": f"Columns with >40% missing data inject significant noise into tree estimators and bias gradient calculations.",
                "impact": "Reduces dimensionality and prevents imputation distortion",
                "priority": "high",
                "tags": ["Data Quality", "Imputation"]
            })

        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "preprocessing",
            "title": "Dual-Strategy Imputation Pipeline",
            "action": "Use Median imputation for skewed numeric features and Mode/Constant for categorical features.",
            "confidence_score": 0.91,
            "reasoning": f"Detected {len(missing_cols)} columns with missing data ({round(missing_ratio * 100, 1)}% total sparsity). Median is resilient against outliers.",
            "impact": "Guarantees 100% complete input vectors for inference",
            "priority": "high",
            "tags": ["Imputation", "Robustness"]
        })

    if outlier_cols:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "preprocessing",
            "title": "RobustScaler & IQR Winsorization",
            "action": f"Apply RobustScaler to {len(outlier_cols)} columns with significant outliers ({', '.join(outlier_cols[:3])}).",
            "confidence_score": 0.88,
            "reasoning": f"StandardScaler uses mean/variance which is distorted by heavy tails. RobustScaler uses interquartile range.",
            "impact": "+4% to +8% convergence speed and model stability",
            "priority": "medium",
            "tags": ["Scaling", "Outliers"]
        })
    else:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "preprocessing",
            "title": "Standard Z-Score Feature Scaling",
            "action": "Apply StandardScaler across all numerical continuous features.",
            "confidence_score": 0.92,
            "reasoning": "Features display low outlier severity. Normalizing to zero-mean and unit-variance optimizes linear & kernel models.",
            "impact": "Equalizes feature gradients across all optimizers",
            "priority": "medium",
            "tags": ["Scaling", "Standardization"]
        })

    if high_cardinality_cols:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "preprocessing",
            "title": "Target / Frequency Encoding for High Cardinality",
            "action": f"Use Target Encoding for {', '.join(high_cardinality_cols)} instead of One-Hot Encoding.",
            "confidence_score": 0.95,
            "reasoning": f"One-Hot Encoding on columns with >15 distinct values causes combinatorial column explosion and RAM exhaustion.",
            "impact": "Saves up to 80% memory while preserving category target correlation",
            "priority": "high",
            "tags": ["Encoding", "Dimensionality"]
        })

    if is_imbalanced:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "preprocessing",
            "title": f"Class Imbalance Mitigation ({round(imbalance_ratio * 100, 1)}% minority class)",
            "action": "Enable Balanced Class Weighting + SMOTE oversampling for training split.",
            "confidence_score": 0.96,
            "reasoning": f"Minority class comprises only {round(imbalance_ratio * 100, 1)}% of samples. Naive training will overfit on accuracy and yield near-zero minority recall.",
            "impact": "+15% to +25% Minority Class F1 / PR-AUC",
            "priority": "high",
            "tags": ["Class Imbalance", "SMOTE"]
        })

    if high_corr_pairs:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "preprocessing",
            "title": f"Multicollinearity Pruning ({len(high_corr_pairs)} highly correlated pairs)",
            "action": f"Prune redundant collinear pairs: {high_corr_pairs[0][0]} ↔ {high_corr_pairs[0][1]} (r={high_corr_pairs[0][2]}).",
            "confidence_score": 0.89,
            "reasoning": "High collinearity degrades SHAP feature attribution accuracy and causes inflated coefficient variance in linear models.",
            "impact": "Improves model interpretability and reduces inference footprint",
            "priority": "medium",
            "tags": ["Feature Selection", "Correlation"]
        })

    # ==================== B. MODEL SELECTION & ARCHITECTURE ====================
    if row_count > 5000:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "modeling",
            "title": "Primary Algorithm: LightGBM / XGBoost",
            "action": "Prioritize Gradient Boosted Decision Trees (LightGBM with histogram binning).",
            "confidence_score": 0.97,
            "reasoning": f"For tabular datasets with {row_count:,} rows and mixed dtypes, histogram-based gradient boosting consistently outperforms deep architectures with 5-10x faster training.",
            "impact": "Top-tier accuracy with <15ms inference latency",
            "priority": "high",
            "tags": ["Algorithm", "LightGBM", "Speed"]
        })
    elif row_count < 1000:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "modeling",
            "title": "Primary Algorithm: Regularized Ensemble / ElasticNet",
            "action": "Use Random Forest with max_depth constraints and ElasticNet Logistic Regression.",
            "confidence_score": 0.93,
            "reasoning": f"Small sample size ({row_count} rows) carries extreme risk of overfitting with complex gradient boosters.",
            "impact": "High generalization score across unseen validation splits",
            "priority": "high",
            "tags": ["Algorithm", "Regularization"]
        })
    else:
        recommendations.append({
            "id": str(uuid.uuid4())[:8],
            "category": "modeling",
            "title": "Primary Algorithm: XGBoost & Random Forest Ensemble",
            "action": "Train XGBoost (n_estimators=150, max_depth=6) alongside ExtraTreesClassifier.",
            "confidence_score": 0.94,
            "reasoning": "Balanced tabular dataset size offers ideal conditions for tree-based ensemble stacking.",
            "impact": "High accuracy with strong resistance to variance",
            "priority": "high",
            "tags": ["Ensemble", "XGBoost"]
        })

    recommendations.append({
        "id": str(uuid.uuid4())[:8],
        "category": "modeling",
        "title": "Stratified 5-Fold Cross Validation",
        "action": "Use StratifiedKFold cross-validation with ROC-AUC scoring objective.",
        "confidence_score": 0.95,
        "reasoning": "Stratification maintains identical target class distribution across folds, preventing optimistic validation bias.",
        "impact": "Accurate production performance estimation",
        "priority": "medium",
        "tags": ["Validation", "Cross-Validation"]
    })

    # ==================== C. DEPLOYMENT INFRASTRUCTURE & SIZING ====================
    # Sizing heuristics based on feature dimensions
    est_memory_mb = max(256, int((col_count * 2) + 128))
    rec_cpu = "1 vCPU" if col_count < 30 else "2 vCPUs"
    rec_ram = "512MB RAM" if est_memory_mb < 512 else "1GB RAM"

    recommendations.append({
        "id": str(uuid.uuid4())[:8],
        "category": "deployment",
        "title": f"Inference Container Sizing: {rec_cpu} / {rec_ram}",
        "action": f"Configure Docker inference service with resource limits of {rec_cpu} and {rec_ram}.",
        "confidence_score": 0.92,
        "reasoning": f"Model parameter graph and preprocessing pipeline require approx ~{est_memory_mb}MB resident memory under 50 req/sec load.",
        "impact": "Prevents OOM kills while eliminating cloud overprovisioning waste",
        "priority": "high",
        "tags": ["Infrastructure", "Docker", "Sizing"]
    })

    recommendations.append({
        "id": str(uuid.uuid4())[:8],
        "category": "deployment",
        "title": "Asynchronous FastAPI Runtime + Gunicorn Uvicorn Workers",
        "action": "Deploy on 4 Uvicorn async workers behind Nginx reverse proxy with gzip compression.",
        "confidence_score": 0.96,
        "reasoning": "Asynchronous event loop decouples request I/O from numpy inference batching, achieving sub-10ms p95 response time.",
        "impact": "Supports 500+ concurrent requests/sec with p99 latency < 25ms",
        "priority": "medium",
        "tags": ["FastAPI", "Latency", "Throughput"]
    })

    # ==================== D. MONITORING & DRIFT DETECTION POLICY ====================
    recommendations.append({
        "id": str(uuid.uuid4())[:8],
        "category": "monitoring",
        "title": "Statistical Drift Monitor: KS-Test (Numeric) + PSI (Categorical)",
        "action": "Schedule daily 24h batch drift checks with Kolmogorov-Smirnov test (p < 0.05 threshold).",
        "confidence_score": 0.98,
        "reasoning": "Kolmogorov-Smirnov two-sample testing identifies continuous feature distribution shifts before model accuracy decays.",
        "impact": "Early warning on data quality anomalies before business impact",
        "priority": "high",
        "tags": ["Drift", "KS-Test", "Observability"]
    })

    recommendations.append({
        "id": str(uuid.uuid4())[:8],
        "category": "monitoring",
        "title": "Automated Retraining Trigger Policy",
        "action": "Trigger automated retraining pipeline when Population Stability Index (PSI) > 0.20 on ≥2 key features.",
        "confidence_score": 0.91,
        "reasoning": "PSI > 0.20 signifies moderate-to-severe demographic or market shift requiring model coefficient recalibration.",
        "impact": "Maintains continuous SLA accuracy without manual engineer intervention",
        "priority": "medium",
        "tags": ["Automation", "Retraining", "CI/CD"]
    })

    # ==================== OVERALL STRATEGY READINESS SCORE ====================
    # Calculate score based on dataset quality factors
    score = 100
    if missing_ratio > 0.10:
        score -= 15
    elif missing_ratio > 0.02:
        score -= 8

    if is_imbalanced:
        score -= 10
    if is_sparse_sample:
        score -= 12
    if len(high_corr_pairs) > 3:
        score -= 8
    if len(outlier_cols) > 3:
        score -= 7

    score = max(35, min(98, score))

    category_counts: Dict[str, Dict[str, int]] = {
        "preprocessing": {"total": 0, "high": 0},
        "modeling": {"total": 0, "high": 0},
        "deployment": {"total": 0, "high": 0},
        "monitoring": {"total": 0, "high": 0},
    }

    for r in recommendations:
        cat = r["category"]
        if cat in category_counts:
            category_counts[cat]["total"] += 1
            if r["priority"] == "high":
                category_counts[cat]["high"] += 1

    category_summaries = []
    for cat, counts in category_counts.items():
        rating = "Optimal" if counts["high"] == 0 else ("Action Needed" if counts["high"] >= 2 else "Caution")
        category_summaries.append({
            "category": cat,
            "total_recommendations": counts["total"],
            "high_priority_count": counts["high"],
            "readiness_rating": rating
        })

    summary = (
        f"AI MLOps Decision Engine analyzed '{dataset_name}' ({row_count:,} rows, {col_count} features). "
        f"Generated {len(recommendations)} actionable recommendations across pipeline stages. "
        f"Dataset shows {'notable missing data and outliers' if total_missing > 0 or outlier_cols else 'strong structural integrity'} "
        f"with an overall MLOps Readiness Score of {score}/100."
    )

    return {
        "project_id": "",
        "dataset_name": dataset_name,
        "task_type": task_type,
        "overall_readiness_score": score,
        "executive_summary": summary,
        "dataset_profile_highlights": {
            "row_count": row_count,
            "col_count": col_count,
            "numeric_columns": len(numeric_cols),
            "categorical_columns": len(categorical_cols),
            "missing_cells": total_missing,
            "missing_percentage": round(missing_ratio * 100, 2),
            "outlier_columns_count": len(outlier_cols),
            "multicollinear_pairs": len(high_corr_pairs),
            "is_imbalanced": is_imbalanced,
            "sample_to_feature_ratio": round(sample_feature_ratio, 1)
        },
        "categories": category_summaries,
        "recommendations": recommendations,
        "generated_at": datetime.utcnow().isoformat() + "Z"
    }
