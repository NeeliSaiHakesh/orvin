from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

class AnalysisResponse(BaseModel):
    id: str
    dataset_id: str
    statistics: Dict[str, Any]
    data_types: Dict[str, Any]
    missing_values: Dict[str, Any]
    outliers: Dict[str, Any]
    correlations: Dict[str, Any]
    class_balance: Optional[Dict[str, Any]] = None
    distributions: Optional[Dict[str, Any]] = None
    ai_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
