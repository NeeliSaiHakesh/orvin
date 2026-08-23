from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
import pandas as pd
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.trained_model import TrainedModel
from app.schemas.training import TrainingConfig, TrainedModelResponse, LeaderboardResponse
from app.engines.automl_engine import train_models

router = APIRouter(tags=["training"])

def model_rank_key(m):
    metrics = m.metrics or {}
    has_valid_path = 1 if (m.model_path and len(m.model_path) > 0) else 0
    score = metrics.get('accuracy', metrics.get('r2', metrics.get('cv_score', 0)))
    if not isinstance(score, (int, float)):
        score = 0
    return (has_valid_path, score)

@router.post("/projects/{project_id}/train", response_model=LeaderboardResponse)
async def start_training(project_id: str, config: TrainingConfig, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        project = Project(id=project_id, user_id=current_user.id, name=f"Project {project_id}", description="Auto-created project")
        db.add(project)
        await db.commit()
        await db.refresh(project)
        
    if config.dataset_id:
        ds_res = await db.execute(select(Dataset).filter(Dataset.id == config.dataset_id))
        dataset = ds_res.scalars().first()
    else:
        ds_res = await db.execute(select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.uploaded_at.desc()))
        dataset = ds_res.scalars().first()

    if not dataset:
        raise HTTPException(status_code=400, detail="No dataset found for project")
        
    df = pd.read_csv(dataset.file_path) if dataset.file_type == 'csv' else pd.read_excel(dataset.file_path)
    
    # Auto-default target column if not set or invalid
    if not project.target_column or project.target_column not in df.columns:
        project.target_column = df.columns[-1]
        await db.commit()
        
    target_col = project.target_column
    X = df.drop(columns=[target_col])
    y = df[target_col]
    
    # Robust task_type detection
    if pd.api.types.is_numeric_dtype(y) and (y.nunique() > 10 or pd.api.types.is_float_dtype(y) or y.nunique() == len(y)):
        task_type = 'regression'
    else:
        task_type = 'classification'
    project.task_type = task_type
    await db.commit()
    
    # Train models
    models_info = train_models(X, y, task_type, str(project.id))
    
    db_models = []
    for info in models_info:
        model = TrainedModel(
            project_id=project.id,
            algorithm=info['algorithm'],
            hyperparameters=info['hyperparameters'],
            metrics=info['metrics'],
            model_path=info.get('model_path') or "",
            training_time_seconds=info['training_time_seconds']
        )
        db.add(model)
        db_models.append(model)
        
    await db.commit()
    for m in db_models:
        await db.refresh(m)
        
    db_models.sort(key=model_rank_key, reverse=True)
    best_id = db_models[0].id if db_models else None
    if db_models:
        db_models[0].is_selected = True
        await db.commit()
    
    # Update project status
    project.status = 'trained'
    await db.commit()
    
    return {"models": db_models, "best_model_id": best_id}

@router.get("/projects/{project_id}/leaderboard", response_model=LeaderboardResponse)
@router.get("/projects/{project_id}/train/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(TrainedModel).filter(TrainedModel.project_id == project_id))
    models = list(result.scalars().all())
    models.sort(key=model_rank_key, reverse=True)
    best_id = models[0].id if models else None
    return {"models": models, "best_model_id": best_id}

@router.get("/models/{model_id}", response_model=TrainedModelResponse)
async def get_model(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
    model = result.scalars().first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model

@router.post("/models/{model_id}/select", response_model=TrainedModelResponse)
async def select_model(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
    model = result.scalars().first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    await db.execute(update(TrainedModel).where(TrainedModel.project_id == model.project_id).values(is_selected=False))
    model.is_selected = True
    await db.commit()
    await db.refresh(model)
    return model
