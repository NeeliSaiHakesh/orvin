from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class ExperimentRunResponse(BaseModel):
    id: str
    project_id: str
    model_id: Optional[str] = None
    run_name: str
    model_version: int
    dataset_version: int
    algorithm: str
    hyperparameters: Dict[str, Any] = {}
    metrics: Dict[str, Any] = {}
    tags: Optional[Dict[str, Any]] = None
    artifacts: Optional[Dict[str, Any]] = None
    status: str
    duration_seconds: float
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CompareRunsRequest(BaseModel):
    run_ids: List[str]

class RunMetricDiff(BaseModel):
    metric_name: str
    values: Dict[str, Optional[float | int | str]]

class RunParamDiff(BaseModel):
    param_name: str
    values: Dict[str, Any]

class ExperimentComparisonResponse(BaseModel):
    runs: List[ExperimentRunResponse]
    parameter_diffs: List[RunParamDiff]
    metrics_comparison: List[RunMetricDiff]
    best_run_id: Optional[str] = None
