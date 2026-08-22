from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.models.analysis import AnalysisReport
from app.schemas.analysis import AnalysisResponse
from app.engines.dataset_analyzer import analyze_dataset

router = APIRouter(tags=["analysis"])

@router.post("/datasets/{dataset_id}/analyze", response_model=AnalysisResponse)
async def run_analysis(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Dataset).filter(Dataset.id == dataset_id))
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    analysis_dict = analyze_dataset(dataset.file_path, dataset.file_type)
    
    # Filter to AnalysisReport fields
    valid_keys = {
        'statistics', 'data_types', 'missing_values', 'outliers',
        'correlations', 'class_balance', 'distributions', 'ai_summary'
    }
    report_data = {k: v for k, v in analysis_dict.items() if k in valid_keys}
    
    # Check if exists
    rep_res = await db.execute(select(AnalysisReport).filter(AnalysisReport.dataset_id == dataset.id))
    existing_report = rep_res.scalars().first()
    
    if existing_report:
        for k, v in report_data.items():
            setattr(existing_report, k, v)
        db_report = existing_report
    else:
        db_report = AnalysisReport(
            dataset_id=dataset.id,
            **report_data
        )
        db.add(db_report)
        
    await db.commit()
    await db.refresh(db_report)
    return db_report

@router.get("/datasets/{dataset_id}/analysis", response_model=AnalysisResponse)
async def get_analysis(dataset_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(AnalysisReport).filter(AnalysisReport.dataset_id == dataset_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found")
    return report
