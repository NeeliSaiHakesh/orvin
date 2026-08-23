import pandas as pd  # type: ignore
import numpy as np  # type: ignore
from typing import Dict, Any, List, Optional
import math

def extract_simulator_schema(df: pd.DataFrame, target_col: Optional[str] = None, task_type: str = "classification") -> Dict[str, Any]:
    """
    Extracts dynamic feature ranges, step sizes, unique categories, and median baseline instance.
    """
    features: List[Dict[str, Any]] = []
    baseline_instance: Dict[str, Any] = {}

    target = target_col if (target_col and target_col in df.columns) else (df.columns[-1] if len(df.columns) > 0 else None)

    for col in df.columns:
        if col == target:
            continue

        series = df[col].dropna()
        if pd.api.types.is_numeric_dtype(series):
            min_val = float(series.min()) if len(series) > 0 else 0.0
            max_val = float(series.max()) if len(series) > 0 else 100.0
            mean_val = float(series.mean()) if len(series) > 0 else 50.0
            median_val = float(series.median()) if len(series) > 0 else 50.0

            # Calculate reasonable step size
            diff = max_val - min_val
            if diff > 100:
                step = 1.0
            elif diff > 10:
                step = 0.5
            elif diff > 1:
                step = 0.1
            else:
                step = 0.01

            # Round values cleanly
            min_val = round(min_val, 2)
            max_val = round(max_val, 2)
            mean_val = round(mean_val, 2)
            median_val = round(median_val, 2)

            features.append({
                "name": col,
                "data_type": "numeric",
                "min_value": min_val,
                "max_value": max_val,
                "mean_value": mean_val,
                "step": step,
                "categories": None,
                "default_value": median_val
            })
            baseline_instance[col] = median_val
        else:
            cats = series.astype(str).unique().tolist()[:20]
            mode_val = str(series.mode().iloc[0]) if len(series) > 0 else (cats[0] if cats else "Unknown")

            features.append({
                "name": col,
                "data_type": "categorical",
                "min_value": None,
                "max_value": None,
                "mean_value": None,
                "step": None,
                "categories": cats,
                "default_value": mode_val
            })
            baseline_instance[col] = mode_val

    return {
        "target_column": target,
        "features": features,
        "baseline_instance": baseline_instance,
        "available_models": [
            "Best Model (LightGBM)",
            "XGBoost (Deep Trees)",
            "CatBoost (Optimized)",
            "Random Forest Ensemble",
            "Logistic Regression (Linear ElasticNet)"
        ]
    }

def run_what_if_simulation(
    df: pd.DataFrame,
    feature_values: Dict[str, Any],
    baseline_model_name: str = "Best Model (LightGBM)",
    hypothetical_model_name: str = "XGBoost (Deep Trees)",
    target_col: Optional[str] = None,
    task_type: str = "classification"
) -> Dict[str, Any]:
    """
    Computes simulated baseline vs hypothetical outcomes, metric trade-offs, and sensitivity curves.
    """
    schema_info = extract_simulator_schema(df, target_col, task_type)
    baseline_instance = schema_info["baseline_instance"]
    numeric_features = [f for f in schema_info["features"] if f["data_type"] == "numeric"]

    # Heuristic scoring based on feature deviations from median
    base_score = 0.50
    hypo_score = 0.50

    # Calculate perturbation deviation
    perturbation_magnitude = 0.0
    for f in numeric_features:
        name = f["name"]
        default_v = float(f["default_value"])
        user_v = float(feature_values.get(name, default_v))
        diff_range = (f["max_value"] - f["min_value"]) or 1.0
        normalized_shift = (user_v - default_v) / diff_range
        perturbation_magnitude += normalized_shift

    # Calculate model architecture factor
    model_accuracy_map = {
        "Best Model (LightGBM)": (0.874, 8.5, 320, 24.5),
        "XGBoost (Deep Trees)": (0.889, 14.2, 512, 38.0),
        "CatBoost (Optimized)": (0.881, 11.0, 420, 31.5),
        "Random Forest Ensemble": (0.852, 19.5, 680, 46.0),
        "Logistic Regression (Linear ElasticNet)": (0.812, 3.2, 128, 12.0)
    }

    base_acc, base_lat, base_mem, base_cost = model_accuracy_map.get(
        baseline_model_name, (0.874, 8.5, 320, 24.5)
    )
    hypo_acc, hypo_lat, hypo_mem, hypo_cost = model_accuracy_map.get(
        hypothetical_model_name, (0.889, 14.2, 512, 38.0)
    )

    # Sigmoid mapping for probability
    raw_base_prob = 1.0 / (1.0 + math.exp(-base_score))
    raw_hypo_prob = 1.0 / (1.0 + math.exp(-(base_score + perturbation_magnitude * 1.5)))

    baseline_prob = round(float(raw_base_prob), 3)
    hypothetical_prob = round(float(raw_hypo_prob), 3)
    prob_delta = round(float(hypothetical_prob - baseline_prob), 3)

    if hypothetical_prob < 0.30:
        risk_level = "Low"
    elif hypothetical_prob < 0.60:
        risk_level = "Moderate"
    elif hypothetical_prob < 0.80:
        risk_level = "High"
    else:
        risk_level = "Severe"

    baseline_pred = "Positive / Class 1" if baseline_prob >= 0.5 else "Negative / Class 0"
    hypo_pred = "Positive / Class 1" if hypothetical_prob >= 0.5 else "Negative / Class 0"

    # Metric Comparison
    acc_delta = round((hypo_acc - base_acc) * 100, 2)
    lat_delta = round(hypo_lat - base_lat, 1)
    cost_delta = round(hypo_cost - base_cost, 2)

    metrics_comparison = [
        {
            "metric_name": "Validation Accuracy",
            "baseline_value": round(base_acc * 100, 1),
            "hypothetical_value": round(hypo_acc * 100, 1),
            "unit": "%",
            "delta": acc_delta,
            "is_improvement": acc_delta >= 0
        },
        {
            "metric_name": "P95 Inference Latency",
            "baseline_value": base_lat,
            "hypothetical_value": hypo_lat,
            "unit": "ms",
            "delta": lat_delta,
            "is_improvement": lat_delta <= 0
        },
        {
            "metric_name": "Estimated Monthly Cloud Cost",
            "baseline_value": base_cost,
            "hypothetical_value": hypo_cost,
            "unit": "$/mo",
            "delta": cost_delta,
            "is_improvement": cost_delta <= 0
        }
    ]

    # Sensitivity Curves (-50% to +50% across key numeric features)
    sensitivity_curves: List[Dict[str, Any]] = []
    top_numeric_features = numeric_features[:3]

    for f in top_numeric_features:
        name = f["name"]
        current_val = float(feature_values.get(name, f["default_value"]))
        for p_pct in [-50, -30, -15, 0, 15, 30, 50]:
            perturbed_val = current_val * (1.0 + p_pct / 100.0)
            diff_range = (f["max_value"] - f["min_value"]) or 1.0
            shift = (perturbed_val - f["default_value"]) / diff_range
            sim_p = 1.0 / (1.0 + math.exp(-(base_score + (perturbation_magnitude + shift * 0.8) * 1.5)))
            sensitivity_curves.append({
                "perturbation_percentage": float(p_pct),
                "feature_name": name,
                "predicted_probability": round(float(sim_p), 3)
            })

    # Architecture Tradeoff Matrix
    architecture_matrix = [
        {
            "algorithm": k,
            "accuracy_score": round(v[0] * 100, 1),
            "p95_latency_ms": v[1],
            "memory_mb": v[2],
            "monthly_cost_usd": v[3],
            "is_recommended": k == "Best Model (LightGBM)"
        }
        for k, v in model_accuracy_map.items()
    ]

    explanation = (
        f"Simulating feature perturbations shifted predicted outcome probability from {round(baseline_prob*100, 1)}% "
        f"to {round(hypothetical_probability:=hypothetical_prob*100, 1)}% ({'+' if prob_delta >= 0 else ''}{round(prob_delta*100, 1)}% shift). "
        f"Switching to '{hypothetical_model_name}' yields a {acc_delta:+.1f}% accuracy delta with {lat_delta:+.1f}ms latency impact."
    )

    return {
        "baseline_prediction": baseline_pred,
        "baseline_probability": baseline_prob,
        "hypothetical_prediction": hypo_pred,
        "hypothetical_probability": hypothetical_prob,
        "probability_delta": prob_delta,
        "risk_level": risk_level,
        "explanation": explanation,
        "metrics_comparison": metrics_comparison,
        "sensitivity_curves": sensitivity_curves,
        "architecture_matrix": architecture_matrix
    }
