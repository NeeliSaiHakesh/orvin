import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime, JSON, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class TrainedModel(Base):
    __tablename__ = 'trained_models'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    dataset_id = Column(String, ForeignKey('datasets.id'), nullable=True)
    version = Column(Integer, default=1, nullable=False)
    dataset_version = Column(Integer, default=1, nullable=True)
    algorithm = Column(String, nullable=False)
    hyperparameters = Column(JSON, nullable=False)
    metrics = Column(JSON, nullable=False)
    pipeline_recipe = Column(JSON, nullable=True)
    model_path = Column(String, nullable=True)
    preprocessor_path = Column(String, nullable=True)
    training_time_seconds = Column(Float, nullable=False)
    is_selected = Column(Boolean, default=False)
    trained_at = Column(DateTime(timezone=True), server_default=func.now())
