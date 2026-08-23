import math
from typing import Dict, Any, List, Optional
import uuid

# Grid Carbon Intensity Factors in g CO2e / kWh
REGIONAL_CARBON_FACTORS: Dict[str, int] = {
    "eu-north-1 (Sweden - Hydro/Nuclear)": 12,
    "us-west-2 (Oregon - Hydro/Renewable)": 112,
    "eu-west-1 (Ireland - Wind/Gas)": 280,
    "eu-central-1 (Frankfurt - Mixed)": 310,
    "us-east-1 (N. Virginia - Gas/Coal)": 379,
    "ap-southeast-1 (Singapore - Natural Gas)": 410,
    "ap-south-1 (Mumbai - Coal Heavy)": 708
}

def calculate_cloud_cost_and_carbon(
    daily_requests: Optional[int] = None,
    target_p95_latency_ms: Optional[float] = None,
    region: str = "us-east-1 (N. Virginia - Gas/Coal)",
    hardware_tier: str = "cpu_standard",
    spot_enabled: bool = False,
    dataset_name: Optional[str] = None,
    row_count: Optional[int] = None,
    column_count: Optional[int] = None
) -> Dict[str, Any]:
    """
    Computes dynamic multi-cloud infrastructure cost ($/month) and carbon emissions (kg CO2e/year)
    tailored directly to dataset dimensional scale and workload parameters.
    """
    cols = column_count if (column_count and column_count > 0) else 14
    rows = row_count if (row_count and row_count > 0) else 1000

    # Dynamic dataset payload calculation
    payload_size_kb = round(max(0.6, cols * 0.16), 1)

    # Inferred recommended workload based on dataset scale
    rec_daily_requests = min(1500000, max(30000, rows * 50))
    rec_latency_ms = 15.0 if cols < 12 else (25.0 if cols < 35 else 40.0)

    active_daily_requests = daily_requests if (daily_requests and daily_requests > 0) else rec_daily_requests
    active_latency_ms = target_p95_latency_ms if (target_p95_latency_ms and target_p95_latency_ms > 0) else rec_latency_ms

    # Feature dimensionality impact on RAM & processing latency
    complexity_factor = 1.0 + max(0.0, (cols - 10) * 0.02)

    # Average throughput capacity per 1 vCPU worker (req/sec)
    base_rps_per_worker = max(10, int((1000 / (active_latency_ms or 25)) / complexity_factor))
    seconds_per_month = 730 * 3600
    total_monthly_requests = active_daily_requests * 30.4

    # Required worker replicas to maintain SLA
    peak_factor = 2.2
    avg_rps = active_daily_requests / 86400.0
    peak_rps = avg_rps * peak_factor
    req_replicas = max(1, math.ceil(peak_rps / base_rps_per_worker))

    # Base RAM scaling according to feature width
    base_ram = 1.0 if cols < 15 else (2.0 if cols < 40 else 4.0)

    # Hardware specs per worker
    if hardware_tier == "arm_graviton":
        vcpus_per_worker = 1.0
        ram_gb_per_worker = max(1.0, base_ram * 0.75)
        power_watts_per_worker = 14.0 * complexity_factor
        cost_multiplier = 0.80
    elif hardware_tier == "gpu_t4":
        vcpus_per_worker = 4.0
        ram_gb_per_worker = 16.0
        power_watts_per_worker = 120.0
        cost_multiplier = 2.80
    else:  # cpu_standard
        vcpus_per_worker = 1.0
        ram_gb_per_worker = base_ram
        power_watts_per_worker = 28.0 * complexity_factor
        cost_multiplier = 1.0

    # Spot / Preemptible discount
    spot_discount = 0.35 if spot_enabled else 1.0

    # Carbon intensity factor (g CO2e / kWh)
    carbon_intensity_g_kwh = REGIONAL_CARBON_FACTORS.get(region, 379)
    pue = 1.15

    # Energy in kWh/year
    annual_kwh = (req_replicas * power_watts_per_worker / 1000.0) * 8760 * pue
    annual_co2_kg = (annual_kwh * carbon_intensity_g_kwh) / 1000.0

    def get_green_rating(co2_kg: float) -> str:
        if co2_kg < 50:
            return "A+"
        elif co2_kg < 200:
            return "A"
        elif co2_kg < 600:
            return "B"
        elif co2_kg < 1200:
            return "C"
        else:
            return "D"

    # --- 1. AWS Estimate (ECS Fargate + ALB) ---
    aws_vcpu_rate = 0.04048 * cost_multiplier
    aws_ram_rate = 0.004445
    aws_fargate_hr = (vcpus_per_worker * aws_vcpu_rate) + (ram_gb_per_worker * aws_ram_rate)
    aws_monthly_compute = req_replicas * aws_fargate_hr * 730 * spot_discount
    aws_alb_cost = 16.0 + (total_monthly_requests / 1_000_000) * 0.8
    aws_monthly_total = round(aws_monthly_compute + aws_alb_cost, 2)
    aws_cost_per_m = round((aws_monthly_total / (total_monthly_requests / 1_000_000)), 3)
    aws_carbon_kg = round(annual_co2_kg * 1.0, 1)

    # --- 2. GCP Estimate (Cloud Run + Serverless VPC) ---
    gcp_vcpu_rate = 0.0384 * cost_multiplier
    gcp_ram_rate = 0.0042
    gcp_active_hr = (vcpus_per_worker * gcp_vcpu_rate) + (ram_gb_per_worker * gcp_ram_rate)
    gcp_monthly_compute = req_replicas * gcp_active_hr * 730 * 0.90 * spot_discount
    gcp_ingress_cost = 8.0 + (total_monthly_requests / 1_000_000) * 0.4
    gcp_monthly_total = round(gcp_monthly_compute + gcp_ingress_cost, 2)
    gcp_cost_per_m = round((gcp_monthly_total / (total_monthly_requests / 1_000_000)), 3)
    gcp_carbon_kg = round(annual_co2_kg * 0.88, 1)

    # --- 3. Azure Estimate (Container Apps + Standard Load Balancer) ---
    azure_vcpu_rate = 0.0395 * cost_multiplier
    azure_ram_rate = 0.0043
    azure_active_hr = (vcpus_per_worker * azure_vcpu_rate) + (ram_gb_per_worker * azure_ram_rate)
    azure_monthly_compute = req_replicas * azure_active_hr * 730 * 0.95 * spot_discount
    azure_gw_cost = 14.0 + (total_monthly_requests / 1_000_000) * 0.6
    azure_monthly_total = round(azure_monthly_compute + azure_gw_cost, 2)
    azure_cost_per_m = round((azure_monthly_total / (total_monthly_requests / 1_000_000)), 3)
    azure_carbon_kg = round(annual_co2_kg * 0.92, 1)

    # --- 4. On-Premise / Bare Metal Estimate ---
    onprem_monthly = round(max(35.0, req_replicas * 18.0 * cost_multiplier), 2)
    onprem_cost_per_m = round((onprem_monthly / (total_monthly_requests / 1_000_000)), 3)
    onprem_carbon_kg = round(annual_co2_kg * 1.35, 1)

    providers = [
        {
            "provider": "Google Cloud",
            "service_name": "Cloud Run (Auto-Scaled)",
            "instance_type": f"{vcpus_per_worker} vCPU, {ram_gb_per_worker}GB RAM",
            "vcpus": vcpus_per_worker,
            "ram_gb": ram_gb_per_worker,
            "monthly_cost_usd": gcp_monthly_total,
            "cost_per_million_requests": gcp_cost_per_m,
            "annual_carbon_kg_co2": gcp_carbon_kg,
            "carbon_intensity_rating": get_green_rating(gcp_carbon_kg),
            "is_cost_winner": False,
            "is_green_winner": True
        },
        {
            "provider": "AWS",
            "service_name": "ECS Fargate + ALB",
            "instance_type": f"{vcpus_per_worker} vCPU, {ram_gb_per_worker}GB RAM",
            "vcpus": vcpus_per_worker,
            "ram_gb": ram_gb_per_worker,
            "monthly_cost_usd": aws_monthly_total,
            "cost_per_million_requests": aws_cost_per_m,
            "annual_carbon_kg_co2": aws_carbon_kg,
            "carbon_intensity_rating": get_green_rating(aws_carbon_kg),
            "is_cost_winner": False,
            "is_green_winner": False
        },
        {
            "provider": "Azure",
            "service_name": "Container Apps Environment",
            "instance_type": f"{vcpus_per_worker} vCPU, {ram_gb_per_worker}GB RAM",
            "vcpus": vcpus_per_worker,
            "ram_gb": ram_gb_per_worker,
            "monthly_cost_usd": azure_monthly_total,
            "cost_per_million_requests": azure_cost_per_m,
            "annual_carbon_kg_co2": azure_carbon_kg,
            "carbon_intensity_rating": get_green_rating(azure_carbon_kg),
            "is_cost_winner": False,
            "is_green_winner": False
        },
        {
            "provider": "On-Premise",
            "service_name": "Private Kubernetes Cluster",
            "instance_type": f"Bare Metal Node Slice ({vcpus_per_worker} Core, {ram_gb_per_worker}GB)",
            "vcpus": vcpus_per_worker,
            "ram_gb": ram_gb_per_worker,
            "monthly_cost_usd": onprem_monthly,
            "cost_per_million_requests": onprem_cost_per_m,
            "annual_carbon_kg_co2": onprem_carbon_kg,
            "carbon_intensity_rating": get_green_rating(onprem_carbon_kg),
            "is_cost_winner": True,
            "is_green_winner": False
        }
    ]

    min_cost = min(p["monthly_cost_usd"] for p in providers)
    min_co2 = min(p["annual_carbon_kg_co2"] for p in providers)

    for p in providers:
        p["is_cost_winner"] = (p["monthly_cost_usd"] == min_cost)
        p["is_green_winner"] = (p["annual_carbon_kg_co2"] == min_co2)

    best_cost_p = next(p["provider"] for p in providers if p["is_cost_winner"])
    best_green_p = next(p["provider"] for p in providers if p["is_green_winner"])

    spot_savings = round(aws_monthly_total * 0.65, 2)
    green_region_co2_diff = round(max(0, annual_co2_kg - ((annual_kwh * 12) / 1000.0)), 1)

    optimizations = [
        {
            "id": "opt-spot",
            "title": "Enable Spot / Preemptible Container Instances",
            "action": "Route 80% of stateless inference workload to Spot capacity pools with automatic graceful draining.",
            "monthly_savings_usd": spot_savings if not spot_enabled else 0.0,
            "carbon_reduction_pct": 0,
            "difficulty": "Easy",
            "impact_description": "Reduces raw compute spend by up to 65% with zero SLA degradation on multi-replica deployments."
        },
        {
            "id": "opt-green-region",
            "title": "Migrate Deployment to Hydro-Powered Carbon-Neutral Region",
            "action": f"Deploy inference cluster to eu-north-1 (Sweden) or us-west-2 (Oregon) to utilize 95%+ renewable hydro power.",
            "monthly_savings_usd": 0.0,
            "carbon_reduction_pct": round(min(96.0, (1.0 - (12.0 / max(13, carbon_intensity_g_kwh))) * 100), 1),
            "difficulty": "Moderate",
            "impact_description": f"Reduces annual carbon footprint by {green_region_co2_diff} kg CO2e without hardware changes."
        },
        {
            "id": "opt-quantization",
            "title": "Apply ONNX C++ Runtime & INT8 Quantization",
            "action": "Compress model graph weights to INT8 to reduce per-request memory throughput by 3.2x.",
            "monthly_savings_usd": round(aws_monthly_total * 0.28, 2),
            "carbon_reduction_pct": 28.0,
            "difficulty": "Advanced",
            "impact_description": "Allows worker consolidation, dropping required replicas from " + str(req_replicas) + " to " + str(max(1, math.ceil(req_replicas * 0.65))) + "."
        }
    ]

    total_pot_savings = round(sum(o["monthly_savings_usd"] for o in optimizations), 2)
    total_pot_carbon_red = round(green_region_co2_diff, 1)

    ds_display = f"'{dataset_name}' ({cols} features, ~{payload_size_kb}KB/payload)" if dataset_name else f"Active Workload ({cols} features)"
    summary = (
        f"Workload sized for {ds_display} processing {active_daily_requests:,} daily inferences under a {active_latency_ms}ms P95 SLA target. "
        f"Requires {req_replicas} parallel container worker(s) across the cluster. "
        f"Best economics: {best_cost_p} (${min_cost}/mo). Lowest emissions: {best_green_p} ({min_co2} kg CO2e/yr)."
    )

    return {
        "project_id": "",
        "dataset_name": dataset_name,
        "dataset_row_count": rows,
        "dataset_column_count": cols,
        "payload_size_kb": payload_size_kb,
        "recommended_daily_requests": rec_daily_requests,
        "recommended_target_latency_ms": rec_latency_ms,
        "daily_requests": active_daily_requests,
        "target_p95_latency_ms": active_latency_ms,
        "selected_region": region,
        "hardware_tier": hardware_tier,
        "spot_enabled": spot_enabled,
        "summary": summary,
        "best_cost_provider": best_cost_p,
        "best_green_provider": best_green_p,
        "total_potential_monthly_savings": total_pot_savings,
        "total_potential_carbon_reduction_kg": total_pot_carbon_red,
        "providers": providers,
        "optimizations": optimizations,
        "regional_carbon_factors": REGIONAL_CARBON_FACTORS
    }
