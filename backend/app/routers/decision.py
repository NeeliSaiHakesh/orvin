from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
import pandas as pd
import os
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.schemas.decision import DecisionReportResponse
from app.engines.decision_engine import generate_decision_report

router = APIRouter(tags=["decisions"])

@router.get("/projects/{project_id}/decisions", response_model=DecisionReportResponse)
async def get_project_decisions(
    project_id: str,
    dataset_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch Project
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    task_type = project.task_type if project and project.task_type else "classification"
    target_col = project.target_column if project else None

    # Fetch Dataset
    if dataset_id:
        ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
        dataset = ds_res.scalars().first()
    else:
        ds_res = await db.execute(
            select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc())
        )
        dataset = ds_res.scalars().first()

    if not dataset:
        raise HTTPException(status_code=404, detail="No dataset found for this project")

    if not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")

    try:
        df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse dataset file: {str(e)}")

    report = generate_decision_report(
        df=df,
        dataset_name=dataset.filename,
        task_type=task_type,
        target_col=target_col
    )
    report["project_id"] = project_id
    report["dataset_id"] = dataset.id

    return report

@router.post("/projects/{project_id}/decisions/generate", response_model=DecisionReportResponse)
async def generate_decisions_for_dataset(
    project_id: str,
    dataset_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await get_project_decisions(project_id=project_id, dataset_id=dataset_id, db=db, current_user=current_user)
