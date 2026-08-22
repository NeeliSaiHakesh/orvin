from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).filter(Project.user_id == current_user.id))
    projects = result.scalars().all()
    for p in projects:
        count_result = await db.execute(select(func.count(Dataset.id)).filter(Dataset.project_id == p.id))
        p.dataset_count = count_result.scalar()
    return projects

@router.post("", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_project = Project(**project.model_dump(), user_id=current_user.id)
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    db_project.dataset_count = 0
    return db_project

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    
    # Auto-create if project ID does not exist yet (e.g. direct link or demo project)
    if not project:
        project = Project(
            id=project_id,
            user_id=current_user.id,
            name=f"Project {project_id[:8]}",
            description="Machine Learning Project",
            task_type="classification",
            status="created"
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        
    count_result = await db.execute(select(func.count(Dataset.id)).filter(Dataset.project_id == project.id))
    project.dataset_count = count_result.scalar()
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, update_data: ProjectUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
        
    await db.commit()
    await db.refresh(project)
    count_result = await db.execute(select(func.count(Dataset.id)).filter(Dataset.project_id == project.id))
    project.dataset_count = count_result.scalar()
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).filter(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.delete(project)
    await db.commit()
    return {"message": "Project deleted"}
