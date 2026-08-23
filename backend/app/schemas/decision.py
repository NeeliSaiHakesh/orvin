from pydantic import BaseModel, Field  # type: ignore
from typing import List, Dict, Any, Optional
from datetime import datetime

class RecommendationItem(BaseModel):
    id: str
    category: str  # preprocessing, modeling, deployment, monitoring
    title: str
    action: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    reasoning: str
    impact: str
    priority: str = "medium"  # high, medium, low
    tags: List[str] = []

class StrategyCategorySummary(BaseModel):
    category: str
    total_recommendations: int
    high_priority_count: int
    readiness_rating: str  # Optimal, Action Needed, Caution

class DecisionReportResponse(BaseModel):
    project_id: str
    dataset_id: Optional[str] = None
    dataset_name: Optional[str] = None
    task_type: str = "classification"
    overall_readiness_score: int = Field(..., ge=0, le=100)
    executive_summary: str
    dataset_profile_highlights: Dict[str, Any]
    categories: List[StrategyCategorySummary]
    recommendations: List[RecommendationItem]
    generated_at: str
