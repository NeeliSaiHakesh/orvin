import sys
import os

# Guarantee current backend directory is at front of Python path for reliable imports on Render/Linux
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request  # type: ignore
from fastapi.responses import JSONResponse  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
import traceback

try:
    from app.config import settings
    from app.database import init_db
    from app.routers import auth, projects, datasets, analysis, cleaning, features, training, explain, api_gen, assistant, decision, simulator, self_healing, cost_carbon, readiness, experiments, version_lineage
except (ImportError, ModuleNotFoundError):
    from .config import settings  # type: ignore
    from .database import init_db  # type: ignore
    from .routers import auth, projects, datasets, analysis, cleaning, features, training, explain, api_gen, assistant, decision, simulator, self_healing, cost_carbon, readiness, experiments, version_lineage  # type: ignore

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        from app.database import AsyncSessionLocal
        from app.seed import seed_demo_data
        async with AsyncSessionLocal() as session:
            await seed_demo_data(session)
    except Exception as e:
        print(f"[STARTUP] Seeding check info: {e}")
    yield

app = FastAPI(
    title="AutoMLOps Platform API",
    description="Backend API for the AutoMLOps Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Open CORS middleware allowing local development, Render, and Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[API ERROR] 500 on {request.method} {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"}
    )

# Dual-mount all routers at both /api/v1 and /api for zero-configuration URL compatibility
routers = [
    auth.router, projects.router, datasets.router, analysis.router,
    cleaning.router, features.router, training.router, explain.router,
    api_gen.router, assistant.router, decision.router, simulator.router,
    self_healing.router, cost_carbon.router, readiness.router, experiments.router,
    version_lineage.router
]

for pfx in ["/api/v1", "/api"]:
    for r in routers:
        app.include_router(r, prefix=pfx)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {
        "app": "AutoMLOps API",
        "version": "1.0.1",
        "build": "2026-08-23-production-ready",
        "status": "healthy",
        "docs": "/docs"
    }
