import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, JSON, Text, func
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class ExplanationReport(Base):
    __tablename__ = 'explanation_reports'
    
    id = Column(String, primary_key=True, default=generate_uuid)
    model_id = Column(String, ForeignKey('trained_models.id'), unique=True, nullable=False)
    shap_values_path = Column(String, nullable=True)
    feature_importance = Column(JSON, nullable=False)
    confusion_matrix = Column(JSON, nullable=True)
    roc_curve = Column(JSON, nullable=True)
    precision_recall = Column(JSON, nullable=True)
    ai_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
