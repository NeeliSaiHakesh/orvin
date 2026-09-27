import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, JSON, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class ExperimentRun(Base):
    __tablename__ = 'experiment_runs'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey('projects.id'), nullable=False, index=True)
    model_id = Column(String, ForeignKey('trained_models.id'), nullable=True)
    run_name = Column(String, nullable=False)
    model_version = Column(Integer, default=1, nullable=False)
    dataset_version = Column(Integer, default=1, nullable=False)
    algorithm = Column(String, nullable=False)
    hyperparameters = Column(JSON, nullable=False, default=dict)
    metrics = Column(JSON, nullable=False, default=dict)
    tags = Column(JSON, nullable=True, default=dict)
    artifacts = Column(JSON, nullable=True, default=dict)
    status = Column(String, default='completed')
    duration_seconds = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
