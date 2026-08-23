from pydantic import BaseModel, Field  # type: ignore
from typing import List, Dict, Any, Optional

class SubsystemHealth(BaseModel):
    id: str
    name: str
    category: str  # container, scaling, retraining, schema
    status: str    # healthy, recovering, degraded, standby
    uptime_percentage: float
    current_latency_ms: float
    current_error_rate: float
    active_replicas: int
    last_healed_at: Optional[str] = None
    description: str

class IncidentEvent(BaseModel):
    id: str
    timestamp: str
    failure_type: str  # oom_crash, cpu_spike, drift_violation, schema_corruption
    severity: str      # critical, high, medium, low
    trigger_metric: str
    remediation_action: str
    status: str        # resolved, in_progress, tripped
    recovery_duration_seconds: float
    details: str

class CircuitBreakerState(BaseModel):
    is_tripped: bool
    state: str  # CLOSED (Healthy), HALF-OPEN (Recovering), OPEN (Tripped)
    failure_count: int
    max_retries: int
    cooldown_seconds_remaining: int
    last_state_change: str

class SelfHealingStatusResponse(BaseModel):
    project_id: str
    overall_health_status: str  # 100% Operational, Healing in Progress, Degraded
    health_score: int
    active_workers_count: int
    total_auto_recoveries: int
    recovery_success_rate: float
    subsystems: List[SubsystemHealth]
    circuit_breaker: CircuitBreakerState
    incident_history: List[IncidentEvent]
    system_metrics: Dict[str, Any]

class TriggerHealingRequest(BaseModel):
    failure_type: str  # oom_crash, cpu_spike, drift_violation, schema_corruption
    simulation_mode: bool = True
