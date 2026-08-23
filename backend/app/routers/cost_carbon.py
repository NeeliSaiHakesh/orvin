from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore
from sqlalchemy.future import select  # type: ignore
from typing import Optional
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.schemas.cost_carbon import CostCarbonResponse, CostCarbonRequest
from app.engines.cost_carbon_engine import calculate_cloud_cost_and_carbon

router = APIRouter(tags=["cost-carbon"])

@router.get("/projects/{project_id}/cost-carbon/estimate", response_model=CostCarbonResponse)
@router.get("/projects/{project_id}/cost-carbon", response_model=CostCarbonResponse)
async def get_cost_carbon_estimate(
    project_id: str,
    dataset_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset_name = None
    if dataset_id:
        ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
        ds = ds_res.scalars().first()
        if ds:
            dataset_name = ds.filename
    else:
        ds_res = await db.execute(
            select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc())
        )
        ds = ds_res.scalars().first()
        if ds:
            dataset_name = ds.filename

    res = calculate_cloud_cost_and_carbon(
        daily_requests=None,
        target_p95_latency_ms=None,
        region="us-east-1 (N. Virginia - Gas/Coal)",
        hardware_tier="cpu_standard",
        spot_enabled=False,
        dataset_name=dataset_name,
        row_count=ds.row_count if ds else None,
        column_count=ds.column_count if ds else None
    )
    res["project_id"] = project_id
    return res

@router.post("/projects/{project_id}/cost-carbon/calculate", response_model=CostCarbonResponse)
async def calculate_custom_cost_carbon(
    project_id: str,
    request: CostCarbonRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset_name = None
    ds = None
    if request.dataset_id:
        ds_res = await db.execute(select(Dataset).filter(Dataset.id == request.dataset_id))
        ds = ds_res.scalars().first()
        if ds:
            dataset_name = ds.filename
    else:
        ds_res = await db.execute(
            select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc())
        )
        ds = ds_res.scalars().first()
        if ds:
            dataset_name = ds.filename

    res = calculate_cloud_cost_and_carbon(
        daily_requests=request.daily_requests,
        target_p95_latency_ms=request.target_p95_latency_ms,
        region=request.region,
        hardware_tier=request.hardware_tier,
        spot_enabled=request.spot_enabled,
        dataset_name=dataset_name,
        row_count=ds.row_count if ds else None,
        column_count=ds.column_count if ds else None
    )
    res["project_id"] = project_id
    return res
