from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore
from sqlalchemy.future import select  # type: ignore
from typing import Optional
import pandas as pd  # type: ignore
import os
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.schemas.simulator import SimulatorSchemaResponse, SimulationRequest, SimulationResponse
from app.engines.simulator_engine import extract_simulator_schema, run_what_if_simulation

router = APIRouter(tags=["simulator"])

@router.get("/projects/{project_id}/simulator/schema", response_model=SimulatorSchemaResponse)
async def get_simulator_schema_endpoint(
    project_id: str,
    dataset_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    task_type = project.task_type if project and project.task_type else "classification"
    target_col = project.target_column if project else None

    if dataset_id:
        ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
        dataset = ds_res.scalars().first()
    else:
        ds_res = await db.execute(
            select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc())
        )
        dataset = ds_res.scalars().first()

    if not dataset or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found for simulation")

    try:
        df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(e)}")

    schema_data = extract_simulator_schema(df, target_col=target_col, task_type=task_type)
    schema_data["project_id"] = project_id
    schema_data["dataset_id"] = dataset.id
    schema_data["dataset_name"] = dataset.filename
    schema_data["task_type"] = task_type

    return schema_data

@router.post("/projects/{project_id}/simulator/run", response_model=SimulationResponse)
async def run_simulation_endpoint(
    project_id: str,
    request: SimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    task_type = project.task_type if project and project.task_type else "classification"
    target_col = project.target_column if project else None

    if request.dataset_id:
        ds_res = await db.execute(select(Dataset).filter(Dataset.id == request.dataset_id))
        dataset = ds_res.scalars().first()
    else:
        ds_res = await db.execute(
            select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc())
        )
        dataset = ds_res.scalars().first()

    if not dataset or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found for simulation")

    try:
        df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(e)}")

    result = run_what_if_simulation(
        df=df,
        feature_values=request.feature_values,
        baseline_model_name=request.baseline_model or "Best Model (LightGBM)",
        hypothetical_model_name=request.hypothetical_model or "XGBoost (Deep Trees)",
        target_col=target_col,
        task_type=task_type
    )

    return result
