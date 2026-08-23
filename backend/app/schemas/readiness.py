from pydantic import BaseModel, Field  # type: ignore
from typing import List, Dict, Any, Optional

class MetricDetail(BaseModel):
    name: str
    score: float
    max_score: float
    status: str  # passed, warning, failed
    detail: str

class PillarScoreItem(BaseModel):
    id: str
    name: str
    weight: int
    score: float
    max_score: int
    status: str  # optimal, caution, critical
    icon: str
    metrics: List[MetricDetail]

class RemediationCheckItem(BaseModel):
    id: str
    pillar: str
    title: str
    severity: str  # critical, high, medium
    action: str
    points_gain: int
    status: str = "pending"

class RadarAxisPoint(BaseModel):
    pillar_name: str
    score_percentage: float

class ProductionReadinessResponse(BaseModel):
    project_id: str
    dataset_name: Optional[str] = None
    overall_score: int = Field(..., ge=0, le=100)
    gate_verdict: str  # APPROVED, CONDITIONAL, BLOCKED
    verdict_badge: str
    verdict_summary: str
    pillars: List[PillarScoreItem]
    radar_data: List[RadarAxisPoint]
    remediation_checklist: List[RemediationCheckItem]
    generated_at: str
