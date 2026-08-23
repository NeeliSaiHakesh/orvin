from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore
from sqlalchemy.future import select  # type: ignore
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.schemas.self_healing import SelfHealingStatusResponse, TriggerHealingRequest
from app.engines.self_healing_engine import (
    get_self_healing_status,
    trigger_simulated_failure_and_healing,
    reset_circuit_breaker_state
)

router = APIRouter(tags=["self-healing"])

@router.get("/projects/{project_id}/self-healing/status", response_model=SelfHealingStatusResponse)
@router.get("/projects/{project_id}/self-healing/health", response_model=SelfHealingStatusResponse)
@router.get("/projects/{project_id}/self-healing/incidents", response_model=SelfHealingStatusResponse)
async def get_project_self_healing_status(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return get_self_healing_status(project_id=project_id)

@router.post("/projects/{project_id}/self-healing/trigger", response_model=SelfHealingStatusResponse)
async def trigger_self_healing_action(
    project_id: str,
    request: TriggerHealingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return trigger_simulated_failure_and_healing(
        project_id=project_id,
        failure_type=request.failure_type
    )

@router.post("/projects/{project_id}/self-healing/circuit-breaker/reset", response_model=SelfHealingStatusResponse)
async def reset_project_circuit_breaker(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    proj_res = await db.execute(select(Project).filter(Project.id == project_id))
    project = proj_res.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return reset_circuit_breaker_state(project_id=project_id)
