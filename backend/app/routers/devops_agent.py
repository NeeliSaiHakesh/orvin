"""FastAPI Router for Autonomous DevOps Agent with Hindsight Memory."""

from fastapi import APIRouter, HTTPException, Query  # type: ignore
from typing import List, Optional

from app.schemas.devops_agent import (
    PRAnalysisRequest,
    PRAnalysisResponse,
    IncidentRetentionRequest,
    MemoryItem,
    StoryModeStep,
    ScenarioPreset
)
from app.engines.hindsight_devops_engine import hindsight_devops_engine

router = APIRouter(prefix="/devops-agent", tags=["DevOps Agent (Hindsight)"])

@router.post("/analyze-pr", response_model=PRAnalysisResponse)
async def analyze_pr_diff(request: PRAnalysisRequest):
    """Analyze a git PR diff or configuration change using Hindsight Memory."""
    try:
        res = await hindsight_devops_engine.analyze_pr(
            diff=request.diff,
            scenario_id=request.scenario_id,
            mode=request.mode
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DevOps Agent analysis failed: {str(e)}")

@router.post("/retain", response_model=MemoryItem)
async def retain_incident(request: IncidentRetentionRequest):
    """Ingest a new post-mortem or failure incident into Hindsight Memory."""
    try:
        memory = await hindsight_devops_engine.retain_incident(
            title=request.title,
            description=request.description,
            category=request.category,
            prevention_rule=request.prevention_rule,
            service=request.service or "ml-inference-service"
        )
        return memory
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Incident retention failed: {str(e)}")

@router.get("/memories", response_model=List[MemoryItem])
async def get_memory_bank(query: Optional[str] = Query(None, description="Optional search filter")):
    """Query the active Hindsight Memory Bank."""
    try:
        memories = hindsight_devops_engine.get_all_memories()
        if query:
            q = query.lower()
            memories = [m for m in memories if q in m["title"].lower() or q in m["summary"].lower() or q in m["category"].lower()]
        return memories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Memory bank retrieval failed: {str(e)}")

@router.get("/story-mode", response_model=List[StoryModeStep])
async def get_story_mode_timeline():
    """Retrieve 3-Stage Temporal Evolution Timeline for demo story mode."""
    return hindsight_devops_engine.get_story_mode_timeline()

@router.get("/scenarios", response_model=List[ScenarioPreset])
async def get_scenarios():
    """Retrieve pre-loaded enterprise scenarios for 1-click demo testing."""
    return hindsight_devops_engine.get_scenarios()
