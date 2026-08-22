import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, JSON, Text, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class AnalysisReport(Base):
    __tablename__ = 'analysis_reports'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    dataset_id = Column(String, ForeignKey('datasets.id'), unique=True, nullable=False)
    statistics = Column(JSON, nullable=False)
    data_types = Column(JSON, nullable=False)
    missing_values = Column(JSON, nullable=False)
    outliers = Column(JSON, nullable=False)
    correlations = Column(JSON, nullable=False)
    class_balance = Column(JSON, nullable=True)
    distributions = Column(JSON, nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
