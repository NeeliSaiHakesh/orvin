from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import pandas as pd
import os
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.models.analysis import AnalysisReport
from app.models.cleaning import CleaningHistory
from app.schemas.cleaning import CleaningConfig, CleaningResponse, CleaningSuggestion
from app.engines.data_cleaner import suggest_cleaning, clean_dataset
from app.engines.dataset_analyzer import analyze_dataset

router = APIRouter(tags=["cleaning"])

@router.post("/datasets/{dataset_id}/clean/suggest", response_model=List[CleaningSuggestion])
async def get_cleaning_suggestions(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
    dataset = ds_res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    rep_res = await db.execute(select(AnalysisReport).filter(AnalysisReport.dataset_id == dataset.id))
    report = rep_res.scalars().first()
    
    df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)

    if report:
        report_dict = {
            'missing_values': report.missing_values,
            'outliers': report.outliers
        }
    else:
        # Generate analysis on the fly
        analysis_dict = analyze_dataset(dataset.file_path, dataset.file_type)
        report_dict = {
            'missing_values': analysis_dict.get('missing_values', {}),
            'outliers': analysis_dict.get('outliers', {})
        }
        
    return suggest_cleaning(df, report_dict)

@router.post("/datasets/{dataset_id}/clean/apply", response_model=CleaningResponse)
async def apply_cleaning(dataset_id: str, config: CleaningConfig, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    import hashlib
    from sqlalchemy import func as sql_func
    from app.config import settings

    ds_res = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
    dataset = ds_res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    rows_before = len(df)
    cols_before = len(df.columns)
    
    cleaned_df, steps = clean_dataset(df, config)
    
    rows_after = len(cleaned_df)
    cols_after = len(cleaned_df.columns)
    
    # 1. Determine next version number for this project
    version_res = await db.execute(
        select(sql_func.max(Dataset.version)).filter(Dataset.project_id == dataset.project_id)
    )
    max_version = version_res.scalar() or 0
    next_version = int(max_version) + 1

    # 2. Construct clean filename
    file_ext = os.path.splitext(dataset.filename)[1].lower() or ('.csv' if dataset.file_type == 'csv' else '.xlsx')
    name_without_ext = os.path.splitext(dataset.filename)[0]
    if not name_without_ext.endswith("_cleaned"):
        clean_filename = f"{name_without_ext}_cleaned{file_ext}"
    else:
        clean_filename = f"{name_without_ext}{file_ext}"

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    final_disk_filename = f"{dataset.project_id[:8]}_v{next_version}_{clean_filename}"
    cleaned_path = os.path.join(settings.UPLOAD_DIR, final_disk_filename)

    if dataset.file_type == 'csv' or file_ext == '.csv':
        cleaned_df.to_csv(cleaned_path, index=False)
    else:
        cleaned_df.to_excel(cleaned_path, index=False, engine='openpyxl')

    # 3. Calculate checksum & size
    sha256_hasher = hashlib.sha256()
    with open(cleaned_path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            sha256_hasher.update(chunk)
    cleaned_hash = sha256_hasher.hexdigest()
    file_size = os.path.getsize(cleaned_path)
    cols_info = {col: str(cleaned_df[col].dtype) for col in cleaned_df.columns}

    # 4. Create new Versioned Dataset record
    cleaned_dataset = Dataset(
        project_id=dataset.project_id,
        filename=clean_filename,
        file_path=cleaned_path,
        file_type=dataset.file_type,
        file_size=file_size,
        file_hash=cleaned_hash,
        version=next_version,
        row_count=rows_after,
        column_count=cols_after,
        columns_info=cols_info,
        status="cleaned"
    )
    db.add(cleaned_dataset)
    await db.flush()

    # 5. Create CleaningHistory linked to new dataset snapshot
    history = CleaningHistory(
        dataset_id=cleaned_dataset.id,
        steps_applied=steps,
        cleaned_file_path=cleaned_path,
        rows_before=rows_before,
        rows_after=rows_after,
        columns_before=cols_before,
        columns_after=cols_after
    )
    db.add(history)
    await db.commit()
    await db.refresh(history)

    # Attach response metadata
    history.new_dataset_id = cleaned_dataset.id  # type: ignore
    history.dataset_version = next_version  # type: ignore
    history.message = f"Cleaned dataset snapshot v{next_version} ({clean_filename}) created successfully."  # type: ignore
    return history

@router.get("/datasets/{dataset_id}/clean/history", response_model=List[CleaningResponse])
async def get_cleaning_history(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(CleaningHistory).filter(CleaningHistory.dataset_id == dataset_id))
    return list(result.scalars().all())
