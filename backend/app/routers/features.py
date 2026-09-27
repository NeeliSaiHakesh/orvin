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
    import os
    import hashlib
    from sqlalchemy import func as sql_func
    from app.config import settings

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
    
    # 1. Determine next version number for this project
    version_res = await db.execute(
        select(sql_func.max(Dataset.version)).filter(Dataset.project_id == dataset.project_id)
    )
    max_version = version_res.scalar() or 0
    next_version = int(max_version) + 1

    # 2. Construct feature filename
    file_ext = os.path.splitext(dataset.filename)[1].lower() or ('.csv' if dataset.file_type == 'csv' else '.xlsx')
    name_without_ext = os.path.splitext(dataset.filename)[0]
    if not name_without_ext.endswith("_features"):
        feat_filename = f"{name_without_ext}_features{file_ext}"
    else:
        feat_filename = f"{name_without_ext}{file_ext}"

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    final_disk_filename = f"{dataset.project_id[:8]}_v{next_version}_{feat_filename}"
    eng_path = os.path.join(settings.UPLOAD_DIR, final_disk_filename)

    if dataset.file_type == 'csv' or file_ext == '.csv':
        engineered_df.to_csv(eng_path, index=False)
    else:
        engineered_df.to_excel(eng_path, index=False, engine='openpyxl')

    # 3. Calculate checksum & size
    sha256_hasher = hashlib.sha256()
    with open(eng_path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            sha256_hasher.update(chunk)
    eng_hash = sha256_hasher.hexdigest()
    file_size = os.path.getsize(eng_path)
    cols_info = {col: str(engineered_df[col].dtype) for col in engineered_df.columns}

    # 4. Create new Versioned Dataset record
    feat_dataset = Dataset(
        project_id=dataset.project_id,
        filename=feat_filename,
        file_path=eng_path,
        file_type=dataset.file_type,
        file_size=file_size,
        file_hash=eng_hash,
        version=next_version,
        row_count=len(engineered_df),
        column_count=len(engineered_df.columns),
        columns_info=cols_info,
        status="features_engineered"
    )
    db.add(feat_dataset)
    await db.commit()
    await db.refresh(feat_dataset)

    # 5. Enrich feature info response
    feature_info["new_dataset_id"] = feat_dataset.id
    feature_info["dataset_version"] = next_version
    feature_info["filename"] = feat_filename
    feature_info["message"] = f"Feature engineered snapshot v{next_version} ({feat_filename}) created successfully."
    
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
