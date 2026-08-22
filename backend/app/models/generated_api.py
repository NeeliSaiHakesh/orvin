import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, JSON, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class GeneratedAPI(Base):
    __tablename__ = 'generated_apis'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    model_id = Column(String, ForeignKey('trained_models.id'), unique=True, nullable=False)
    code_path = Column(String, nullable=False)
    dockerfile_path = Column(String, nullable=True)
    requirements = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
