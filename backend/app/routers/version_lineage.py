import os
import json
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, func as sql_func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.cleaning import CleaningHistory
from app.models.trained_model import TrainedModel
from app.models.generated_api import GeneratedAPI
from app.config import settings

router = APIRouter(tags=["version_lineage"])

class RollbackRequest(BaseModel):
    target_version: int
    model_id: Optional[str] = None

def _get_model_score(m: Any) -> float:
    metrics = getattr(m, 'metrics', None)
    if not isinstance(metrics, dict):
        return 0.0
    for k in ['accuracy', 'r2', 'f1', 'cv_score', 'roc_auc']:
        val = metrics.get(k)
        if isinstance(val, (int, float)):
            return float(val)
    return 0.0

@router.get("/projects/{project_id}/version-history")
async def get_project_version_history(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the complete linked version chain across all layers:
    Dataset Version → Preprocessing & Recipe Version → Model Version → API Deployment Version.
    """
    # 1. Verify Project
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Fetch all datasets for this project
    ds_res = await db.execute(
        select(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.version.asc())
    )
    datasets = list(ds_res.scalars().all())

    # 3. Fetch all cleaning histories for this project's datasets
    dataset_ids = [d.id for d in datasets]
    cleaning_histories = []
    if dataset_ids:
        cl_res = await db.execute(
            select(CleaningHistory).filter(CleaningHistory.dataset_id.in_(dataset_ids)).order_by(CleaningHistory.created_at.desc())
        )
        cleaning_histories = list(cl_res.scalars().all())
    cleaning_by_dataset = {c.dataset_id: c for c in cleaning_histories}

    # 4. Fetch all trained models for this project
    tm_res = await db.execute(
        select(TrainedModel).filter(TrainedModel.project_id == project_id).order_by(TrainedModel.version.asc())
    )
    models = list(tm_res.scalars().all())

    # 5. Fetch all generated APIs for these models
    model_ids = [m.id for m in models]
    apis = []
    if model_ids:
        api_res = await db.execute(
            select(GeneratedAPI).filter(GeneratedAPI.model_id.in_(model_ids))
        )
        apis = list(api_res.scalars().all())
    api_by_model = {a.model_id: a for a in apis}

    # 6. Group models by version
    models_by_version: Dict[int, List[TrainedModel]] = {}
    for m in models:
        v = m.version or 1
        models_by_version.setdefault(v, []).append(m)

    datasets_by_version: Dict[int, Dataset] = {d.version: d for d in datasets if d.version}

    # Determine all distinct version numbers across datasets and models
    all_version_nums = sorted(list(set(list(datasets_by_version.keys()) + list(models_by_version.keys()))))
    if not all_version_nums:
        all_version_nums = [1]

    chains = []
    active_version = 1

    for v in all_version_nums:
        dataset = datasets_by_version.get(v)
        if not dataset and datasets:
            # Fallback to closest dataset
            dataset = datasets[0]

        cleaning = cleaning_by_dataset.get(dataset.id) if dataset else None
        version_models = models_by_version.get(v, [])
        
        # Sort version models by performance
        version_models.sort(key=_get_model_score, reverse=True)

        selected_model = next((m for m in version_models if m.is_selected), None)
        if not selected_model and version_models:
            selected_model = version_models[0]

        is_chain_active = bool(selected_model and selected_model.is_selected)
        if not models and v == max(all_version_nums):
            is_chain_active = True
        if is_chain_active:
            active_version = v

        # Extract recipe
        recipe = None
        if selected_model and selected_model.pipeline_recipe:
            recipe = selected_model.pipeline_recipe
        else:
            recipe_file = os.path.join(settings.MODEL_REGISTRY_DIR, f"{project_id}_v{v}_pipeline_recipe.json")
            if os.path.exists(recipe_file):
                try:
                    with open(recipe_file, 'r', encoding='utf-8') as f:
                        recipe = json.load(f)
                except Exception:
                    pass

        # API info
        generated_api = api_by_model.get(selected_model.id) if selected_model else None

        chain_entry = {
            "version": v,
            "is_active": is_chain_active,
            "created_at": selected_model.trained_at.isoformat() if (selected_model and selected_model.trained_at) else (dataset.uploaded_at.isoformat() if (dataset and dataset.uploaded_at) else None),
            "dataset": {
                "id": dataset.id if dataset else None,
                "version": dataset.version if dataset else v,
                "filename": dataset.filename if dataset else "customer_data.csv",
                "file_hash": getattr(dataset, "file_hash", None) if dataset else None,
                "row_count": dataset.row_count if dataset else None,
                "column_count": dataset.column_count if dataset else None,
                "status": getattr(dataset, "status", "uploaded") if dataset else "uploaded",
                "uploaded_at": dataset.uploaded_at.isoformat() if (dataset and dataset.uploaded_at) else None
            } if dataset else None,
            "cleaning": {
                "id": cleaning.id if cleaning else None,
                "steps_applied": cleaning.steps_applied if cleaning else [],
                "rows_before": cleaning.rows_before if cleaning else None,
                "rows_after": cleaning.rows_after if cleaning else None,
                "created_at": cleaning.created_at.isoformat() if (cleaning and cleaning.created_at) else None
            } if cleaning else None,
            "recipe": {
                "recipe_version": f"recipe_v{v}",
                "applied_steps_count": len(cleaning.steps_applied) if cleaning else (len(recipe.get("cleaning_recipe", {}).get("applied_steps", [])) if recipe else 0),
                "features_count": len(recipe.get("feature_engineering_recipe", {}).get("features", [])) if recipe else (dataset.column_count if dataset else 0),
                "test_size": recipe.get("validation_split_recipe", {}).get("test_size", 0.2) if recipe else 0.2,
                "cv_folds": recipe.get("validation_split_recipe", {}).get("cv_folds", 5) if recipe else 5,
                "details": recipe
            } if recipe else None,
            "model": {
                "id": selected_model.id if selected_model else None,
                "algorithm": selected_model.algorithm if selected_model else "AutoML Ensemble",
                "version": v,
                "metrics": selected_model.metrics if selected_model else {},
                "hyperparameters": selected_model.hyperparameters if selected_model else {},
                "model_path": selected_model.model_path if selected_model else None,
                "training_time_seconds": selected_model.training_time_seconds if selected_model else 0.0,
                "is_selected": bool(selected_model and selected_model.is_selected),
                "total_candidates": len(version_models)
            } if selected_model else None,
            "api": {
                "id": generated_api.id if generated_api else None,
                "framework": "FastAPI + Uvicorn",
                "endpoint": f"/predict (v{v})",
                "status": "active" if is_chain_active else "standby",
                "has_dockerfile": bool(generated_api and generated_api.dockerfile_path),
                "created_at": generated_api.created_at.isoformat() if (generated_api and generated_api.created_at) else None
            } if (generated_api or selected_model) else None
        }
        chains.append(chain_entry)

    # Sort chains descending so newest version is at top
    chains.sort(key=lambda c: c["version"], reverse=True)

    return {
        "project_id": project_id,
        "project_name": project.name,
        "active_version": active_version,
        "total_versions": len(chains),
        "chains": chains
    }

@router.post("/projects/{project_id}/rollback")
async def rollback_project_version(
    project_id: str,
    request: RollbackRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Rolls back the active production model to any previous version without retraining.
    Atomic operation: deselects all models and promotes the target version model.
    """
    target_v = request.target_version
    
    # 1. Verify Project
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Find target model(s) for this version
    if request.model_id:
        target_res = await db.execute(
            select(TrainedModel).filter(TrainedModel.id == request.model_id, TrainedModel.project_id == project_id)
        )
    else:
        target_res = await db.execute(
            select(TrainedModel).filter(TrainedModel.project_id == project_id, TrainedModel.version == target_v)
        )
    
    target_models = list(target_res.scalars().all())
    if not target_models:
        raise HTTPException(status_code=404, detail=f"No trained models found for Version v{target_v}")

    # Pick the best model of that version if not specified
    target_models.sort(key=_get_model_score, reverse=True)
    promoted_model = target_models[0]

    # 3. Atomic Switch: Deselect all and mark promoted model as active
    await db.execute(
        update(TrainedModel).where(TrainedModel.project_id == project_id).values(is_selected=False)
    )
    promoted_model.is_selected = True
    project.status = 'trained'  # type: ignore
    
    await db.commit()
    await db.refresh(promoted_model)

    return {
        "status": "success",
        "message": f"Successfully rolled back production model to Version v{target_v} ({promoted_model.algorithm}) without retraining.",
        "active_version": target_v,
        "active_model_id": promoted_model.id,
        "algorithm": promoted_model.algorithm,
        "metrics": promoted_model.metrics
    }
