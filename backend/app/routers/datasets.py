from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.schemas.dataset import DatasetResponse, DatasetPreview
import os
import shutil
import pandas as pd
from app.config import settings

router = APIRouter(tags=["datasets"])

@router.post("/projects/{project_id}/datasets", response_model=DatasetResponse)
async def upload_dataset(project_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size = os.path.getsize(file_path)
    file_type = file.filename.split('.')[-1].lower()
    
    # Fast row/column detection
    try:
        if file_type == 'csv':
            df_sample = pd.read_csv(file_path, nrows=100)
            # Count total rows efficiently
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                row_count = max(0, sum(1 for _ in f) - 1)
            cols_info = {col: str(df_sample[col].dtype) for col in df_sample.columns}
            col_count = len(df_sample.columns)
        elif file_type in ['xlsx', 'xls']:
            df = pd.read_excel(file_path)
            file_type = 'excel'
            row_count = len(df)
            col_count = len(df.columns)
            cols_info = {col: str(df[col].dtype) for col in df.columns}
        elif file_type == 'json':
            df = pd.read_json(file_path)
            row_count = len(df)
            col_count = len(df.columns)
            cols_info = {col: str(df[col].dtype) for col in df.columns}
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        # Fallback to standard reading
        df = pd.read_csv(file_path) if file_type == 'csv' else pd.read_excel(file_path)
        row_count = len(df)
        col_count = len(df.columns)
        cols_info = {col: str(df[col].dtype) for col in df.columns}
        
    db_dataset = Dataset(
        project_id=project_id,
        filename=file.filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        row_count=row_count,
        column_count=col_count,
        columns_info=cols_info
    )
    db.add(db_dataset)
    await db.commit()
    await db.refresh(db_dataset)
    return db_dataset

@router.get("/projects/{project_id}/datasets", response_model=list[DatasetResponse])
async def list_datasets(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc()))
    return result.scalars().all()

@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
    ds = result.scalars().first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds

@router.get("/datasets/{dataset_id}/preview", response_model=DatasetPreview)
async def preview_dataset(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    ds = await get_dataset(dataset_id, db, current_user)
    if ds.file_type == 'csv':
        df = pd.read_csv(ds.file_path, nrows=100)
    else:
        df = pd.read_excel(ds.file_path, nrows=100) if ds.file_type == 'excel' else pd.read_json(ds.file_path)
    return {
        "columns": df.columns.tolist(),
        "rows": df.fillna("").to_dict('records'),
        "total_rows": ds.row_count
    }

@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    ds = await get_dataset(dataset_id, db, current_user)
    try:
        os.remove(ds.file_path)
    except FileNotFoundError:
        pass
    await db.delete(ds)
    await db.commit()
    return {"message": "Dataset deleted"}
