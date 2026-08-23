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
    daily_requests: int = 100000,
    target_p95_latency_ms: float = 25.0,
    region: str = "us-east-1 (N. Virginia - Gas/Coal)",
    hardware_tier: str = "cpu_standard",
    spot_enabled: bool = False,
    dataset_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes precise multi-cloud infrastructure cost ($/month) and carbon emissions (kg CO2e/year)
    across AWS, GCP, Azure, and On-Premise architectures.
    """
    # Average throughput capacity per 1 vCPU worker (req/sec) based on latency target
    base_rps_per_worker = max(10, int(1000 / (target_p95_latency_ms or 25)))
    seconds_per_month = 730 * 3600
    total_monthly_requests = daily_requests * 30.4

    # Required worker replicas to maintain SLA
    peak_factor = 2.2  # Peak vs average traffic ratio
    avg_rps = daily_requests / 86400.0
    peak_rps = avg_rps * peak_factor
    req_replicas = max(1, math.ceil(peak_rps / base_rps_per_worker))

    # Hardware specs per worker
    if hardware_tier == "arm_graviton":
        vcpus_per_worker = 1.0
        ram_gb_per_worker = 1.0
        power_watts_per_worker = 14.0  # High efficiency ARM
        cost_multiplier = 0.80         # Graviton 20% discount
    elif hardware_tier == "gpu_t4":
        vcpus_per_worker = 4.0
        ram_gb_per_worker = 16.0
        power_watts_per_worker = 120.0 # GPU acceleration
        cost_multiplier = 2.80
    else:  # cpu_standard
        vcpus_per_worker = 1.0
        ram_gb_per_worker = 2.0
        power_watts_per_worker = 28.0
        cost_multiplier = 1.0

    # Spot / Preemptible discount
    spot_discount = 0.35 if spot_enabled else 1.0

    # Carbon intensity factor (g CO2e / kWh)
    carbon_intensity_g_kwh = REGIONAL_CARBON_FACTORS.get(region, 379)
    pue = 1.15  # Cloud Datacenter Power Usage Effectiveness

    # Energy in kWh/year: (replicas * Watts / 1000) * 8760 hours * PUE
    annual_kwh = (req_replicas * power_watts_per_worker / 1000.0) * 8760 * pue
    annual_co2_kg = (annual_kwh * carbon_intensity_g_kwh) / 1000.0

    # Helper to assign green rating
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
    # Fargate: $0.04048 per vCPU-hr, $0.004445 per GB-hr + $18 ALB
    aws_compute_monthly = req_replicas * 730 * (
        (vcpus_per_worker * 0.04048 * cost_multiplier) + (ram_gb_per_worker * 0.004445)
    ) * spot_discount
    aws_total_monthly = round(aws_compute_monthly + 16.0, 2)
    aws_cost_per_m = round((aws_total_monthly / (total_monthly_requests / 1_000_000)), 3)

    # --- 2. GCP Estimate (Cloud Run + Cloud Armor) ---
    # Cloud Run: $0.00002400 / vCPU-sec, $0.00000250 / GB-sec
    gcp_compute_monthly = req_replicas * 730 * 3600 * (
        (vcpus_per_worker * 0.00002400 * cost_multiplier) + (ram_gb_per_worker * 0.00000250)
    ) * spot_discount
    gcp_total_monthly = round(gcp_compute_monthly + 12.0, 2)
    gcp_cost_per_m = round((gcp_total_monthly / (total_monthly_requests / 1_000_000)), 3)

    # --- 3. Azure Estimate (Container Apps) ---
    azure_compute_monthly = req_replicas * 730 * 3600 * (
        (vcpus_per_worker * 0.000024 * cost_multiplier) + (ram_gb_per_worker * 0.000003)
    ) * spot_discount
    azure_total_monthly = round(azure_compute_monthly + 14.0, 2)
    azure_cost_per_m = round((azure_total_monthly / (total_monthly_requests / 1_000_000)), 3)

    # --- 4. On-Premise / Bare Metal Estimate ---
    # Hardware amortization ($18/node/mo) + Electricity ($0.14/kWh)
    onprem_monthly_kwh = (req_replicas * power_watts_per_worker * 1.3 / 1000.0) * 730
    onprem_total_monthly = round((req_replicas * 18.0) + (onprem_monthly_kwh * 0.14), 2)
    onprem_cost_per_m = round((onprem_total_monthly / (total_monthly_requests / 1_000_000)), 3)
    onprem_annual_co2 = annual_co2_kg * 1.25  # Lower PUE efficiency in private racks

    providers = [
        {
            "provider": "Google Cloud (GCP)",
            "service_name": "Cloud Run Serverless Container",
            "instance_type": f"{vcpus_per_worker} vCPU / {ram_gb_per_worker}GB RAM",
            "vcpus": vcpus_per_worker * req_replicas,
            "ram_gb": ram_gb_per_worker * req_replicas,
            "monthly_cost_usd": gcp_total_monthly,
            "cost_per_million_requests": gcp_cost_per_m,
            "annual_carbon_kg_co2": round(annual_co2_kg, 1),
            "carbon_intensity_rating": get_green_rating(annual_co2_kg),
            "is_cost_winner": False,
            "is_green_winner": False
        },
        {
            "provider": "Amazon Web Services (AWS)",
            "service_name": "ECS Fargate + ALB",
            "instance_type": f"Fargate ({vcpus_per_worker} vCPU, {ram_gb_per_worker}GB)",
            "vcpus": vcpus_per_worker * req_replicas,
            "ram_gb": ram_gb_per_worker * req_replicas,
            "monthly_cost_usd": aws_total_monthly,
            "cost_per_million_requests": aws_cost_per_m,
            "annual_carbon_kg_co2": round(annual_co2_kg * 1.05, 1),
            "carbon_intensity_rating": get_green_rating(annual_co2_kg * 1.05),
            "is_cost_winner": False,
            "is_green_winner": False
        },
        {
            "provider": "Microsoft Azure",
            "service_name": "Azure Container Apps",
            "instance_type": f"Consumption Tier ({vcpus_per_worker} Core)",
            "vcpus": vcpus_per_worker * req_replicas,
            "ram_gb": ram_gb_per_worker * req_replicas,
            "monthly_cost_usd": azure_total_monthly,
            "cost_per_million_requests": azure_cost_per_m,
            "annual_carbon_kg_co2": round(annual_co2_kg * 1.02, 1),
            "carbon_intensity_rating": get_green_rating(annual_co2_kg * 1.02),
            "is_cost_winner": False,
            "is_green_winner": False
        },
        {
            "provider": "On-Premise / Bare Metal",
            "service_name": "Self-Hosted K8s Cluster",
            "instance_type": "Bare Metal 1U Node",
            "vcpus": vcpus_per_worker * req_replicas,
            "ram_gb": ram_gb_per_worker * req_replicas,
            "monthly_cost_usd": onprem_total_monthly,
            "cost_per_million_requests": onprem_cost_per_m,
            "annual_carbon_kg_co2": round(onprem_annual_co2, 1),
            "carbon_intensity_rating": get_green_rating(onprem_annual_co2),
            "is_cost_winner": False,
            "is_green_winner": False
        }
    ]

    # Determine Cost Winner and Green Winner
    min_cost = min(p["monthly_cost_usd"] for p in providers)
    min_co2 = min(p["annual_carbon_kg_co2"] for p in providers)

    for p in providers:
        if p["monthly_cost_usd"] == min_cost:
            p["is_cost_winner"] = True
        if p["annual_carbon_kg_co2"] == min_co2:
            p["is_green_winner"] = True

    cost_winner = next(p["provider"] for p in providers if p["is_cost_winner"])
    green_winner = next(p["provider"] for p in providers if p["is_green_winner"])

    # Green MLOps Optimization Recommendations
    optimizations = [
        {
            "id": "opt-spot",
            "title": "Enable Spot / Preemptible Worker Pool",
            "action": "Route non-critical background batch inference and 50% of web replicas to Spot instances.",
            "monthly_savings_usd": round(aws_total_monthly * 0.65, 2),
            "carbon_reduction_pct": 0.0,
            "difficulty": "Easy",
            "impact_description": "Reduces raw compute spend by up to 65% with zero impact on P95 latency."
        },
        {
            "id": "opt-onnx",
            "title": "ONNX Runtime & INT8 Quantization",
            "action": "Quantize trained tree/neural models from FP32 to INT8 and deploy via ONNX C++ runtime.",
            "monthly_savings_usd": round(aws_total_monthly * 0.40, 2),
            "carbon_reduction_pct": 58.0,
            "difficulty": "Moderate",
            "impact_description": "Increases throughput by 2.8x, halving required active container replicas and energy draw."
        },
        {
            "id": "opt-green-region",
            "title": "Low-Carbon Regional Routing (eu-north-1 / us-west-2)",
            "action": "Deploy primary inference endpoint to hydro/renewable powered datacenter regions.",
            "monthly_savings_usd": 0.0,
            "carbon_reduction_pct": 82.0,
            "difficulty": "Easy",
            "impact_description": "Slashing annual carbon footprint from 379g/kWh down to 12g/kWh (up to 88% net reduction)."
        },
        {
            "id": "opt-scale-zero",
            "title": "Scale-to-Zero Off-Peak Idle Policy",
            "action": "Configure serverless minimum replicas to 0 between 12:00 AM – 6:00 AM UTC.",
            "monthly_savings_usd": round(aws_total_monthly * 0.22, 2),
            "carbon_reduction_pct": 24.0,
            "difficulty": "Easy",
            "impact_description": "Eliminates idle compute energy waste during low-traffic overnight windows."
        }
    ]

    total_potential_savings = sum(o["monthly_savings_usd"] for o in optimizations)
    total_co2_reduct = round(annual_co2_kg * 0.68, 1)

    summary = (
        f"For {daily_requests:,} requests/day (~{round(total_monthly_requests/1_000_000, 1)}M/mo) with a {target_p95_latency_ms}ms SLA, "
        f"{cost_winner} provides the lowest cost (${min_cost}/mo) and {green_winner} provides the lowest carbon intensity ({min_co2} kg CO₂e/yr). "
        f"Applying Green MLOps optimizations unlocks up to ${total_potential_savings}/mo in savings and {total_co2_reduct} kg CO₂e reduction."
    )

    return {
        "project_id": "",
        "dataset_name": dataset_name,
        "daily_requests": daily_requests,
        "target_p95_latency_ms": target_p95_latency_ms,
        "selected_region": region,
        "hardware_tier": hardware_tier,
        "spot_enabled": spot_enabled,
        "summary": summary,
        "best_cost_provider": cost_winner,
        "best_green_provider": green_winner,
        "total_potential_monthly_savings": total_potential_savings,
        "total_potential_carbon_reduction_kg": total_co2_reduct,
        "providers": providers,
        "optimizations": optimizations,
        "regional_carbon_factors": REGIONAL_CARBON_FACTORS
    }
