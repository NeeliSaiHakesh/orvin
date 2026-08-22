from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

class DatasetBase(BaseModel):
    pass

class DatasetResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    file_type: str
    file_size: int
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    columns_info: Optional[Dict[str, Any]] = None
    status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class DatasetPreview(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
