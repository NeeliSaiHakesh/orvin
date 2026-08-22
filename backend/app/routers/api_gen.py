from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import os
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.trained_model import TrainedModel
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.generated_api import GeneratedAPI
from app.engines.api_generator import generate_api
from app.config import settings

router = APIRouter(tags=["api_gen"])

@router.post("/models/{model_id}/generate-api")
async def generate_api_endpoint(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    mod_res = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
    model_db = mod_res.scalars().first()
    if not model_db:
        raise HTTPException(status_code=404, detail="Model not found")
        
    proj_res = await db.execute(select(Project).filter(Project.id == model_db.project_id))
    project = proj_res.scalars().first()
    
    ds_res = await db.execute(select(Dataset).filter(Dataset.project_id == project.id).order_by(Dataset.uploaded_at.desc()))
    dataset = ds_res.scalars().first()
    
    feature_names = [c for c in list((dataset.columns_info or {}).keys()) if c != project.target_column] if dataset else []
    
    api_info = generate_api(model_db.model_path, feature_names, dataset.columns_info if dataset else {}, f"{project.name}_{model_db.algorithm}")
    
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
    if not api_db:
        # Auto-generate if not yet generated
        try:
            return await generate_api_endpoint(model_id, db, current_user)
        except Exception:
            raise HTTPException(status_code=404, detail="API not generated yet")
        
    files = {}
    if api_db.code_path and os.path.exists(api_db.code_path):
        for root, dirs, filenames in os.walk(api_db.code_path):
            for file in filenames:
                try:
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        files[file] = f.read()
                except Exception:
                    pass
                
    return files

@router.get("/models/{model_id}/download-api")
async def download_api(model_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    mod_res = await db.execute(select(TrainedModel).filter(TrainedModel.id == model_id))
    model_db = mod_res.scalars().first()
    if not model_db:
        raise HTTPException(status_code=404, detail="Model not found")
        
    proj_res = await db.execute(select(Project).filter(Project.id == model_db.project_id))
    project = proj_res.scalars().first()
        
    zip_path = os.path.join(settings.MODEL_REGISTRY_DIR, f"{project.name}_{model_db.algorithm}_api.zip")
    if not os.path.exists(zip_path):
        # Auto-generate if zip is missing
        await generate_api_endpoint(model_id, db, current_user)
        
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="ZIP file not found")
        
    return FileResponse(zip_path, media_type="application/zip", filename=f"{project.name}_api.zip")
