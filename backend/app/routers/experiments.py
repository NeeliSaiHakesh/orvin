from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.experiment import ExperimentRun
from app.schemas.experiment import (
    ExperimentRunResponse,
    CompareRunsRequest,
    ExperimentComparisonResponse,
    RunMetricDiff,
    RunParamDiff
)

router = APIRouter(tags=["experiments"])

@router.get("/projects/{project_id}/experiments", response_model=List[ExperimentRunResponse])
async def list_experiment_runs(
    project_id: str,
    algorithm: Optional[str] = Query(None, description="Filter by algorithm"),
    model_version: Optional[int] = Query(None, description="Filter by model version"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all MLflow-style experiment runs logged for a project."""
    query = select(ExperimentRun).filter(ExperimentRun.project_id == project_id)
    if algorithm:
        query = query.filter(ExperimentRun.algorithm == algorithm)
    if model_version:
        query = query.filter(ExperimentRun.model_version == model_version)
        
    query = query.order_by(ExperimentRun.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/experiments/{run_id}", response_model=ExperimentRunResponse)
async def get_experiment_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve detailed telemetry, hyperparameters, and metrics for a specific experiment run."""
    result = await db.execute(select(ExperimentRun).filter(ExperimentRun.id == run_id))
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    return run

@router.post("/projects/{project_id}/experiments/compare", response_model=ExperimentComparisonResponse)
async def compare_experiment_runs(
    project_id: str,
    request: CompareRunsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Compare multiple experiment runs side-by-side: computes hyperparameter diffs and metric deltas."""
    if len(request.run_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 run IDs are required for comparison")
        
    result = await db.execute(
        select(ExperimentRun).filter(
            ExperimentRun.project_id == project_id,
            ExperimentRun.id.in_(request.run_ids)
        )
    )
    runs = list(result.scalars().all())
    if len(runs) < 2:
        raise HTTPException(status_code=404, detail="Could not find matching experiment runs to compare")

    # Collect all unique parameter and metric keys
    all_param_keys = set()
    all_metric_keys = set()
    for run in runs:
        if run.hyperparameters:
            all_param_keys.update(run.hyperparameters.keys())
        if run.metrics:
            all_metric_keys.update(run.metrics.keys())

    # Build parameter diffs
    parameter_diffs = []
    for p_key in sorted(all_param_keys):
        val_map = {}
        for run in runs:
            val_map[run.id] = (run.hyperparameters or {}).get(p_key)
        parameter_diffs.append(RunParamDiff(param_name=p_key, values=val_map))

    # Build metric comparisons (exclude complex nested metrics like confusion_matrix)
    metrics_comparison = []
    for m_key in sorted(all_metric_keys):
        val_map = {}
        has_scalar = False
        for run in runs:
            v = (run.metrics or {}).get(m_key)
            if isinstance(v, (int, float, str)) or v is None:
                val_map[run.id] = v
                if v is not None:
                    has_scalar = True
        if has_scalar:
            metrics_comparison.append(RunMetricDiff(metric_name=m_key, values=val_map))

    # Determine best run by accuracy / r2 / cv_mean
    best_run = max(
        runs,
        key=lambda r: (r.metrics or {}).get('accuracy', (r.metrics or {}).get('r2', (r.metrics or {}).get('cv_mean', 0))) or 0,
        default=runs[0]
    )

    return ExperimentComparisonResponse(
        runs=runs,
        parameter_diffs=parameter_diffs,
        metrics_comparison=metrics_comparison,
        best_run_id=best_run.id if best_run else None
    )

@router.delete("/experiments/{run_id}")
async def delete_experiment_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an experiment run log."""
    result = await db.execute(select(ExperimentRun).filter(ExperimentRun.id == run_id))
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Experiment run not found")
    await db.delete(run)
    await db.commit()
    return {"message": "Experiment run deleted successfully"}
