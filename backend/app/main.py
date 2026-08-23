import sys
import os

# Guarantee current backend directory is at front of Python path for reliable imports on Render/Linux
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

try:
    from app.config import settings
    from app.database import init_db
    from app.routers import auth, projects, datasets, analysis, cleaning, features, training, explain, api_gen, assistant, decision, simulator, self_healing, cost_carbon, readiness
except (ImportError, ModuleNotFoundError):
    from .config import settings  # type: ignore
    from .database import init_db  # type: ignore
    from .routers import auth, projects, datasets, analysis, cleaning, features, training, explain, api_gen, assistant, decision, simulator, self_healing, cost_carbon, readiness  # type: ignore

app = FastAPI(
    title="AutoMLOps Platform API",
    description="Backend API for the AutoMLOps Platform",
    version="1.0.0"
)

# Open CORS middleware allowing local development, Render, and Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(datasets.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(cleaning.router, prefix="/api/v1")
app.include_router(features.router, prefix="/api/v1")
app.include_router(training.router, prefix="/api/v1")
app.include_router(explain.router, prefix="/api/v1")
app.include_router(api_gen.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(decision.router, prefix="/api/v1")
app.include_router(simulator.router, prefix="/api/v1")
app.include_router(self_healing.router, prefix="/api/v1")
app.include_router(cost_carbon.router, prefix="/api/v1")
app.include_router(readiness.router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {
        "app": "AutoMLOps API",
        "version": "1.0.0",
        "docs": "/docs"
    }
