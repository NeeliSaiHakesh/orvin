from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import os
import re
import logging
import joblib
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.trained_model import TrainedModel
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.generated_api import GeneratedAPI
from app.engines.api_generator import generate_api, resolve_artifact_path
from app.config import settings

from typing import Any

logger = logging.getLogger(__name__)

router = APIRouter(tags=["api_gen"])


def _read_code_files(code_path: Any) -> dict[str, str]:
    """Read all code files from the generated API directory."""
    files: dict[str, str] = {}
    path_str = str(code_path) if code_path else ""
    if path_str and os.path.exists(path_str):
        for root, dirs, filenames in os.walk(path_str):
            for file in filenames:
                try:
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        files[file] = f.read()
                except Exception:
                    pass
    return files


@router.post("/models/{model_id}/generate-api")
async def generate_api_endpoint(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    mod_res = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
    model_db = mod_res.scalars().first()
    if not model_db:
        raise HTTPException(status_code=404, detail="Model not found")
        
    proj_res = await db.execute(select(Project).filter(Project.id == model_db.project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    ds_res = await db.execute(select(Dataset).filter(Dataset.project_id == project.id).order_by(Dataset.uploaded_at.desc()))
    dataset = ds_res.scalars().first()

    # ── Load preprocessor metadata ──
    preprocessor_path = getattr(model_db, 'preprocessor_path', None) or ''
    preprocessing_metadata = None
    model_library = 'scikit-learn'
    model_library_version = None

    # Try loading from the persisted preprocessor file (new-style models)
    resolved_prep_path = resolve_artifact_path(preprocessor_path)
    if resolved_prep_path and os.path.exists(resolved_prep_path):
        try:
            bundle = joblib.load(resolved_prep_path)
            if isinstance(bundle, dict):
                preprocessing_metadata = bundle.get('metadata', {})
        except Exception as e:
            logger.warning(f"Could not load preprocessor from {resolved_prep_path}: {e}")

    # Try extracting library info from pipeline_recipe (stored in DB)
    recipe = model_db.pipeline_recipe or {}
    if isinstance(recipe, dict):
        model_library = recipe.get('model_library', 'scikit-learn')
        model_library_version = recipe.get('model_library_version')
        if not resolved_prep_path or not os.path.exists(resolved_prep_path):
            preprocessor_path = recipe.get('preprocessor_path', '')
            resolved_prep_path = resolve_artifact_path(preprocessor_path)

    # Fallback feature info for legacy models (no preprocessor persisted)
    feature_names = []
    feature_types = {}
    if dataset:
        feature_names = [c for c in list((dataset.columns_info or {}).keys()) if c != (project.target_column or '')] 
        feature_types = dataset.columns_info or {}

    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', f"{project.name}_{model_db.algorithm}")
    resolved_model_path = resolve_artifact_path(model_db.model_path)
    
    try:
        api_info = generate_api(
            model_path=resolved_model_path or model_db.model_path,
            model_name=safe_name,
            task_type=project.task_type or 'classification',
            preprocessor_path=resolved_prep_path if resolved_prep_path and os.path.exists(resolved_prep_path) else None,
            preprocessing_metadata=preprocessing_metadata,
            model_library=model_library,
            model_library_version=model_library_version,
            feature_names=feature_names,
            feature_types=feature_types,
        )
    except RuntimeError as e:
        logger.warning(f"API generation blocked: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Failed to generate API")
        raise HTTPException(status_code=500, detail=str(e))
    
    # Upsert logic to prevent unique constraint conflicts
    existing_res = await db.execute(select(GeneratedAPI).filter(GeneratedAPI.model_id == model_db.id))
    gen_api = existing_res.scalars().first()
    
    if gen_api:
        gen_api.code_path = api_info['code_path']
        gen_api.dockerfile_path = api_info['dockerfile_path']
        gen_api.requirements = api_info['requirements']
    else:
        gen_api = GeneratedAPI(
            model_id=model_db.id,
            code_path=api_info['code_path'],
            dockerfile_path=api_info['dockerfile_path'],
            requirements=api_info['requirements']
        )
        db.add(gen_api)
        
    await db.commit()
    await db.refresh(gen_api)
    
    return gen_api


@router.get("/models/{model_id}/api-code")
async def get_api_code(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(GeneratedAPI).filter(GeneratedAPI.model_id == model_id))
    api_db = res.scalars().first()
    
    needs_generation = False
    if not api_db or not api_db.code_path or not os.path.exists(api_db.code_path):
        needs_generation = True
    else:
        files_on_disk = [f for f in os.listdir(api_db.code_path) if os.path.isfile(os.path.join(api_db.code_path, f))]
        if not files_on_disk:
            needs_generation = True
            
    if needs_generation:
        try:
            api_db = await generate_api_endpoint(model_id, db, current_user)
        except Exception as e:
            logger.warning(f"Auto-generation in get_api_code failed: {e}")
            
    files = {}
    if api_db and api_db.code_path:
        files = _read_code_files(api_db.code_path)
    
    # If files dictionary is still empty, provide standard preview files
    if not files or 'main.py' not in files:
        mod_res = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
        m = mod_res.scalars().first()
        alg = m.algorithm if m else "Model"
        files = {
            'main.py': f'from fastapi import FastAPI\nfrom schemas import PredictionInput, PredictionOutput\nimport joblib\nimport pandas as pd\n\napp = FastAPI(title="{alg} Prediction API")\nmodel = joblib.load("model.joblib")\n\n@app.post("/predict", response_model=PredictionOutput)\ndef predict(data: PredictionInput):\n    df = pd.DataFrame([data.model_dump()])\n    pred = model.predict(df)[0]\n    return {{"prediction": int(pred), "model_name": "{alg}"}}\n',
            'schemas.py': 'from pydantic import BaseModel, Field\nfrom typing import Optional\n\nclass PredictionInput(BaseModel):\n    feature_1: float = Field(0.0, description="Feature 1")\n    feature_2: float = Field(0.0, description="Feature 2")\n\nclass PredictionOutput(BaseModel):\n    prediction: int\n    model_name: str\n',
            'Dockerfile': 'FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]\n',
            'requirements.txt': 'fastapi==0.104.1\nuvicorn[standard]==0.24.0\njoblib==1.3.2\npandas==2.1.4\nscikit-learn==1.3.2\n'
        }
                
    return files


@router.get("/models/{model_id}/download-api")
async def download_api(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    mod_res = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
    model_db = mod_res.scalars().first()
    if not model_db:
        raise HTTPException(status_code=404, detail="Model not found")
        
    proj_res = await db.execute(select(Project).filter(Project.id == model_db.project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', f"{project.name}_{model_db.algorithm}")
    zip_path = os.path.join(settings.MODEL_REGISTRY_DIR, f"{safe_name}_api.zip")
    
    resolved_zip = resolve_artifact_path(zip_path)
    if not resolved_zip or not os.path.exists(resolved_zip):
        # Auto-generate if zip is missing
        await generate_api_endpoint(model_id, db, current_user)
        resolved_zip = resolve_artifact_path(zip_path)
        
    if not resolved_zip or not os.path.exists(resolved_zip):
        raise HTTPException(status_code=404, detail="ZIP file not found")
        
    return FileResponse(resolved_zip, media_type="application/zip", filename=f"{safe_name}_api.zip")
