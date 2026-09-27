import hashlib
import uuid
import os
import shutil
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func as sql_func
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.schemas.dataset import DatasetResponse, DatasetPreview
from app.config import settings

router = APIRouter(tags=["datasets"])

@router.post("/projects/{project_id}/datasets", response_model=DatasetResponse)
async def upload_dataset(
    project_id: str,
    file: UploadFile = File(...),
    force_reupload: bool = Query(False, description="Force re-upload even if identical file hash exists"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    clean_filename = os.path.basename(file.filename or "dataset.csv")
    temp_filename = f"temp_{uuid.uuid4().hex}_{clean_filename}"
    temp_path = os.path.join(settings.UPLOAD_DIR, temp_filename)
    
    # 1. Stream file and compute SHA256 checksum
    try:
        sha256_hasher = hashlib.sha256()
        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                sha256_hasher.update(chunk)
                buffer.write(chunk)
                
        file_hash = sha256_hasher.hexdigest()
        file_size = os.path.getsize(temp_path)
        file_type = clean_filename.split('.')[-1].lower()

        # 2. Check for duplicate dataset in this project
        existing_res = await db.execute(
            select(Dataset)
            .filter(Dataset.project_id == project_id, Dataset.file_hash == file_hash)
            .order_by(Dataset.uploaded_at.desc())
        )
        existing_dataset = existing_res.scalars().first()

        if existing_dataset and not force_reupload:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            resp = DatasetResponse(
                id=existing_dataset.id,
                project_id=existing_dataset.project_id,
                filename=existing_dataset.filename,
                file_type=existing_dataset.file_type,
                file_size=existing_dataset.file_size,
                file_hash=existing_dataset.file_hash,
                version=existing_dataset.version,
                row_count=existing_dataset.row_count,
                column_count=existing_dataset.column_count,
                columns_info=existing_dataset.columns_info,
                status=existing_dataset.status,
                uploaded_at=existing_dataset.uploaded_at,
                is_duplicate=True,
                message=f"Identical dataset already uploaded as v{existing_dataset.version} ({existing_dataset.filename}). Re-upload skipped."
            )
            return resp

        # 3. Determine next version number for this project
        version_res = await db.execute(
            select(sql_func.max(Dataset.version)).filter(Dataset.project_id == project_id)
        )
        max_version = version_res.scalar() or 0
        next_version = max_version + 1

        # 4. Save file permanently with version prefix
        final_filename = f"{project_id[:8]}_v{next_version}_{clean_filename}"
        final_file_path = os.path.join(settings.UPLOAD_DIR, final_filename)
        shutil.move(temp_path, final_file_path)
        
        # Fast row/column detection
        row_count = 0
        col_count = 0
        cols_info = {}

        if file_type == 'csv':
            df_sample = pd.read_csv(final_file_path, nrows=50)
            col_count = len(df_sample.columns)
            cols_info = {str(col): str(df_sample[col].dtype) for col in df_sample.columns}
            with open(final_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                row_count = max(0, sum(1 for _ in f) - 1)
        elif file_type in ['xlsx', 'xls']:
            df = pd.read_excel(final_file_path)
            file_type = 'excel'
            row_count = len(df)
            col_count = len(df.columns)
            cols_info = {str(col): str(df[col].dtype) for col in df.columns}
        elif file_type == 'json':
            df = pd.read_json(final_file_path)
            row_count = len(df)
            col_count = len(df.columns)
            cols_info = {str(col): str(df[col].dtype) for col in df.columns}
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV, Excel, or JSON.")
            
        db_dataset = Dataset(
            project_id=project_id,
            filename=file.filename or clean_filename,
            file_path=final_file_path,
            file_type=file_type,
            file_size=file_size,
            file_hash=file_hash,
            version=next_version,
            row_count=row_count,
            column_count=col_count,
            columns_info=cols_info,
            status="uploaded"
        )
        db.add(db_dataset)
        await db.commit()
        await db.refresh(db_dataset)

        resp = DatasetResponse(
            id=db_dataset.id,
            project_id=db_dataset.project_id,
            filename=db_dataset.filename,
            file_type=db_dataset.file_type,
            file_size=db_dataset.file_size,
            file_hash=db_dataset.file_hash,
            version=db_dataset.version,
            row_count=db_dataset.row_count,
            column_count=db_dataset.column_count,
            columns_info=db_dataset.columns_info,
            status=db_dataset.status,
            uploaded_at=db_dataset.uploaded_at,
            is_duplicate=False,
            message=f"Dataset v{next_version} ({clean_filename}) uploaded successfully."
        )
        return resp
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded file: {str(e)}")

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
