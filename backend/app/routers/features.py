from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any
import pandas as pd
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.models.project import Project
from app.engines.feature_engineer import engineer_features

router = APIRouter(tags=["features"])

@router.post("/datasets/{dataset_id}/features/engineer")
async def engineer(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
    dataset = ds_res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    proj_res = await db.execute(select(Project).filter(Project.id == dataset.project_id))
    project = proj_res.scalars().first()
    
    df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    
    target_col = project.target_column if project and project.target_column in df.columns else df.columns[-1]
    task_type = project.task_type if project and project.task_type else ('regression' if pd.api.types.is_numeric_dtype(df[target_col]) and df[target_col].nunique() > 10 else 'classification')

    engineered_df, feature_info = engineer_features(df, target_col, task_type)
    
    eng_path = dataset.file_path.replace(f".{dataset.file_type}", f"_features.{dataset.file_type}")
    if dataset.file_type == 'csv':
        engineered_df.to_csv(eng_path, index=False)
    else:
        engineered_df.to_excel(eng_path, index=False)
        
    dataset.file_path = eng_path
    dataset.column_count = len(engineered_df.columns)
    await db.commit()
    
    return feature_info

@router.get("/datasets/{dataset_id}/features")
async def get_features(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
    dataset = ds_res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    proj_res = await db.execute(select(Project).filter(Project.id == dataset.project_id))
    project = proj_res.scalars().first()
    
    df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    target_col = project.target_column if project and project.target_column in df.columns else df.columns[-1]
    task_type = project.task_type if project and project.task_type else ('regression' if pd.api.types.is_numeric_dtype(df[target_col]) and df[target_col].nunique() > 10 else 'classification')

    _, feature_info = engineer_features(df, target_col, task_type)
    return feature_info

@router.get("/datasets/{dataset_id}/features/importance")
async def get_feature_importance(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    info = await get_features(dataset_id, db, current_user)
    return {"importance": info.get("feature_importance", {})}
