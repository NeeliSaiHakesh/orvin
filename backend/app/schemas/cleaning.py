from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

class CleaningSuggestion(BaseModel):
    step_name: str
    description: str
    affected_columns: List[str]
    impact: str

class CleaningConfig(BaseModel):
    drop_high_missing: bool = True
    fill_missing: bool = True
    remove_duplicates: bool = True
    handle_outliers: bool = False
    convert_types: bool = True
    normalize: bool = False
    encode_categorical: bool = False
    remove_correlated: bool = False

class CleaningResponse(BaseModel):
    id: str
    dataset_id: str
    steps_applied: List[Dict[str, Any]]
    rows_before: int
    rows_after: int
    columns_before: int
    columns_after: int
    created_at: datetime

    class Config:
        from_attributes = True
