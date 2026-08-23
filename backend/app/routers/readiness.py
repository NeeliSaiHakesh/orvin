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
from app.schemas.readiness import ProductionReadinessResponse
from app.engines.readiness_engine import evaluate_production_readiness

router = APIRouter(tags=["readiness"])

@router.get("/projects/{project_id}/readiness/score", response_model=ProductionReadinessResponse)
async def get_production_readiness_score(
    project_id: str,
    dataset_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task_type = project.task_type or "classification"

    if dataset_id:
        ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
        dataset = ds_res.scalars().first()
    else:
        ds_res = await db.execute(
            select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc())
        )
        dataset = ds_res.scalars().first()

    if not dataset or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found for readiness evaluation")

    try:
        df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(e)}")

    res = evaluate_production_readiness(
        df=df,
        dataset_name=dataset.filename,
        task_type=task_type
    )
    res["project_id"] = project_id
    return res
