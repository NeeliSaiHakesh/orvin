from pydantic import BaseModel, Field  # type: ignore
from typing import List, Dict, Any, Optional

class FeatureSchemaItem(BaseModel):
    name: str
    data_type: str  # numeric, categorical
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    mean_value: Optional[float] = None
    step: Optional[float] = None
    categories: Optional[List[str]] = None
    default_value: Any

class SimulatorSchemaResponse(BaseModel):
    project_id: str
    dataset_id: Optional[str] = None
    dataset_name: Optional[str] = None
    task_type: str
    target_column: Optional[str] = None
    features: List[FeatureSchemaItem]
    baseline_instance: Dict[str, Any]
    available_models: List[str]

class SimulationRequest(BaseModel):
    dataset_id: Optional[str] = None
    feature_values: Dict[str, Any]
    baseline_model: Optional[str] = "Best Model (LightGBM)"
    hypothetical_model: Optional[str] = "XGBoost (Deep Trees)"

class MetricComparison(BaseModel):
    metric_name: str
    baseline_value: float
    hypothetical_value: float
    unit: str
    delta: float
    is_improvement: bool

class SensitivityPoint(BaseModel):
    perturbation_percentage: float
    feature_name: str
    predicted_probability: float

class ArchitectureComparison(BaseModel):
    algorithm: str
    accuracy_score: float
    p95_latency_ms: float
    memory_mb: int
    monthly_cost_usd: float
    is_recommended: bool = False

class SimulationResponse(BaseModel):
    baseline_prediction: Any
    baseline_probability: float
    hypothetical_prediction: Any
    hypothetical_probability: float
    probability_delta: float
    risk_level: str  # Low, Moderate, High, Severe
    explanation: str
    metrics_comparison: List[MetricComparison]
    sensitivity_curves: List[SensitivityPoint]
    architecture_matrix: List[ArchitectureComparison]
