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
    
    cleaned_path = dataset.file_path.replace(f".{dataset.file_type}", f"_cleaned.{dataset.file_type}")
    if dataset.file_type == 'csv':
        cleaned_df.to_csv(cleaned_path, index=False)
    else:
        cleaned_df.to_excel(cleaned_path, index=False)
        
    dataset.file_path = cleaned_path
    dataset.row_count = rows_after
    dataset.column_count = cols_after
    
    history = CleaningHistory(
        dataset_id=dataset.id,
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
    return history

@router.get("/datasets/{dataset_id}/clean/history", response_model=List[CleaningResponse])
async def get_cleaning_history(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(CleaningHistory).filter(CleaningHistory.dataset_id == dataset_id))
    return list(result.scalars().all())
