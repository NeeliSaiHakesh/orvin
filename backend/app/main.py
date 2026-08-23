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

# Dual-mount all routers at both /api/v1 and /api for zero-configuration URL compatibility
routers = [
    auth.router, projects.router, datasets.router, analysis.router,
    cleaning.router, features.router, training.router, explain.router,
    api_gen.router, assistant.router, decision.router, simulator.router,
    self_healing.router, cost_carbon.router, readiness.router
]

for pfx in ["/api/v1", "/api"]:
    for r in routers:
        app.include_router(r, prefix=pfx)

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
