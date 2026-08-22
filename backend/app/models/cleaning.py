import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class CleaningHistory(Base):
    __tablename__ = 'cleaning_history'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    dataset_id = Column(String, ForeignKey('datasets.id'), nullable=False)
    steps_applied = Column(JSON, nullable=False)
    cleaned_file_path = Column(String, nullable=False)
    rows_before = Column(Integer, nullable=False)
    rows_after = Column(Integer, nullable=False)
    columns_before = Column(Integer, nullable=False)
    columns_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
