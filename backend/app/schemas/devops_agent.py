from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class PRAnalysisRequest(BaseModel):
    diff: str = Field(..., description="Git diff or configuration change text to analyze")
    scenario_id: Optional[str] = Field(None, description="Pre-loaded scenario ID if selecting a preset")
    mode: str = Field("auto", description="Execution mode: 'day1' (no memory), 'day14' (recall), 'day60' (reflect & patch)")

class IncidentRetentionRequest(BaseModel):
    title: str = Field(..., description="Short incident summary or post-mortem title")
    description: str = Field(..., description="Detailed failure description, stack trace, or root cause")
    category: str = Field("dependency", description="Category: dependency, hardware_oom, secret_drift, runtime_crash")
    prevention_rule: str = Field(..., description="Synthesized rule or patch guideline")
    service: Optional[str] = Field("ml-inference-service", description="Affected microservice or component")

class MemoryItem(BaseModel):
    id: str
    timestamp: str
    title: str
    category: str
    summary: str
    prevention_rule: str
    severity: str = "HIGH"
    recall_score: Optional[float] = 0.95

class PRAnalysisResponse(BaseModel):
    mode: str
    risk_score: int = Field(..., ge=0, le=100, description="Blast radius / risk score (0-100%)")
    risk_level: str = Field(..., description="LOW, MEDIUM, HIGH, CRITICAL")
    recalled_memories: List[MemoryItem] = []
    issues_found: List[str] = []
    prevention_rule: Optional[str] = None
    suggested_patch: Optional[str] = None
    explanation: str
    memory_used: bool

class StoryModeStep(BaseModel):
    day: str
    stage_name: str
    description: str
    risk_score: int
    risk_level: str
    recalled_count: int
    summary: str
    action_taken: str
    auto_patch_available: bool

class ScenarioPreset(BaseModel):
    id: str
    title: str
    category: str
    diff: str
    expected_risk_day1: int
    expected_risk_hindsight: int
    description: str
