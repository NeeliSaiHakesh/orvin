import uuid
from sqlalchemy import Column, String, Float, Boolean, ForeignKey, DateTime, JSON, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class TrainedModel(Base):
    __tablename__ = 'trained_models'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey('projects.id'), nullable=False)
    algorithm = Column(String, nullable=False)
    hyperparameters = Column(JSON, nullable=False)
    metrics = Column(JSON, nullable=False)
    model_path = Column(String, nullable=True)
    training_time_seconds = Column(Float, nullable=False)
    is_selected = Column(Boolean, default=False)
    trained_at = Column(DateTime(timezone=True), server_default=func.now())
