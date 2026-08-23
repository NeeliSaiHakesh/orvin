from pydantic import BaseModel, Field  # type: ignore
from typing import List, Dict, Any, Optional

class CloudProviderEstimate(BaseModel):
    provider: str  # AWS, GCP, Azure, On-Premise
    service_name: str
    instance_type: str
    vcpus: float
    ram_gb: float
    monthly_cost_usd: float
    cost_per_million_requests: float
    annual_carbon_kg_co2: float
    carbon_intensity_rating: str  # A+, A, B, C, D
    is_cost_winner: bool = False
    is_green_winner: bool = False

class GreenOptimizationItem(BaseModel):
    id: str
    title: str
    action: str
    monthly_savings_usd: float
    carbon_reduction_pct: float
    difficulty: str  # Easy, Moderate, Advanced
    impact_description: str

class CostCarbonResponse(BaseModel):
    project_id: str
    dataset_name: Optional[str] = None
    dataset_row_count: Optional[int] = None
    dataset_column_count: Optional[int] = None
    payload_size_kb: Optional[float] = None
    recommended_daily_requests: Optional[int] = None
    recommended_target_latency_ms: Optional[float] = None
    daily_requests: int
    target_p95_latency_ms: float
    selected_region: str
    hardware_tier: str
    spot_enabled: bool
    summary: str
    best_cost_provider: str
    best_green_provider: str
    total_potential_monthly_savings: float
    total_potential_carbon_reduction_kg: float
    providers: List[CloudProviderEstimate]
    optimizations: List[GreenOptimizationItem]
    regional_carbon_factors: Dict[str, int]

class CostCarbonRequest(BaseModel):
    dataset_id: Optional[str] = None
    daily_requests: Optional[int] = None
    target_p95_latency_ms: Optional[float] = None
    region: str = "us-east-1 (N. Virginia - Gas/Coal)"
    hardware_tier: str = "cpu_standard"  # cpu_standard, arm_graviton, gpu_t4
    spot_enabled: bool = False
