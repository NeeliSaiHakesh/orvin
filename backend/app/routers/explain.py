from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import joblib
import pandas as pd
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.trained_model import TrainedModel
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.explanation import ExplanationReport
from app.engines.explainer import explain_model
from app.engines.automl_engine import _preprocess_features
from sklearn.preprocessing import LabelEncoder

router = APIRouter(tags=["explain"])

@router.get("/models/{model_id}/explain")
async def get_explanation(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    mod_res = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
    model_db = mod_res.scalars().first()
    if not model_db:
        raise HTTPException(status_code=404, detail="Model not found")
        
    exp_res = await db.execute(select(ExplanationReport).filter(ExplanationReport.model_id == model_id))
    report = exp_res.scalars().first()
    
    if not report:
        proj_res = await db.execute(select(Project).filter(Project.id == model_db.project_id))
        project = proj_res.scalars().first()
        
        ds_res = await db.execute(select(Dataset).filter(Dataset.project_id == project.id).order_by(Dataset.uploaded_at.desc()))
        dataset = ds_res.scalars().first()
        
        df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
        target_col = project.target_column or df.columns[-1]
        X = df.drop(columns=[target_col])
        y = df[target_col]
        
        X = _preprocess_features(X)
        if project.task_type == 'classification' and not pd.api.types.is_numeric_dtype(y):
            y = pd.Series(LabelEncoder().fit_transform(y.fillna("unknown").astype(str)), index=y.index)
        
        if not model_db.model_path:
            raise HTTPException(status_code=400, detail="Model artifact path is missing")
            
        sk_model = joblib.load(model_db.model_path)
        exp_dict = explain_model(sk_model, X, y, project.task_type or 'regression')
        
        # Check again to avoid race conditions
        existing_res = await db.execute(select(ExplanationReport).filter(ExplanationReport.model_id == model_id))
        report = existing_res.scalars().first()
        
        if not report:
            report = ExplanationReport(
                model_id=model_db.id,
                feature_importance=exp_dict.get('feature_importance', {}),
                confusion_matrix=exp_dict.get('confusion_matrix'),
                roc_curve=exp_dict.get('roc_curve'),
                precision_recall=exp_dict.get('precision_recall')
            )
            db.add(report)
            await db.commit()
            await db.refresh(report)
        
    return report

@router.get("/models/{model_id}/shap")
async def get_shap_data(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"message": "SHAP feature importances available"}
