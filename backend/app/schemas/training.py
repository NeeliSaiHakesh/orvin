from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

class TrainingConfig(BaseModel):
    test_size: float = 0.2
    cv_folds: int = 5
    scoring_metric: str = 'auto'
    models_to_train: Optional[List[str]] = None
    dataset_id: Optional[str] = None

class TrainedModelResponse(BaseModel):
    id: str
    project_id: str
    algorithm: str
    hyperparameters: Dict[str, Any]
    metrics: Dict[str, Any]
    training_time_seconds: float
    is_selected: bool
    trained_at: datetime

    class Config:
        from_attributes = True

class LeaderboardResponse(BaseModel):
    models: List[TrainedModelResponse]
    best_model_id: Optional[str] = None
    dataset_stats: Optional[Dict[str, Any]] = None
