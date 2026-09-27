import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

try:
    from app.config import settings
except (ImportError, ModuleNotFoundError):
    from .config import settings  # type: ignore

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.MODEL_REGISTRY_DIR, exist_ok=True)

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

def _run_migrations(connection):
    """Ensure newly added columns exist in existing tables without breaking data."""
    from sqlalchemy import inspect, text
    inspector = inspect(connection)
    tables = inspector.get_table_names()
    
    if 'datasets' in tables:
        ds_cols = [c['name'] for c in inspector.get_columns('datasets')]
        if 'file_hash' not in ds_cols:
            connection.execute(text("ALTER TABLE datasets ADD COLUMN file_hash VARCHAR"))
        if 'version' not in ds_cols:
            connection.execute(text("ALTER TABLE datasets ADD COLUMN version INTEGER DEFAULT 1"))
            
    if 'trained_models' in tables:
        tm_cols = [c['name'] for c in inspector.get_columns('trained_models')]
        if 'version' not in tm_cols:
            connection.execute(text("ALTER TABLE trained_models ADD COLUMN version INTEGER DEFAULT 1"))
        if 'dataset_version' not in tm_cols:
            connection.execute(text("ALTER TABLE trained_models ADD COLUMN dataset_version INTEGER DEFAULT 1"))
        if 'dataset_id' not in tm_cols:
            connection.execute(text("ALTER TABLE trained_models ADD COLUMN dataset_id VARCHAR"))
        if 'pipeline_recipe' not in tm_cols:
            connection.execute(text("ALTER TABLE trained_models ADD COLUMN pipeline_recipe JSON"))
        if 'preprocessor_path' not in tm_cols:
            connection.execute(text("ALTER TABLE trained_models ADD COLUMN preprocessor_path VARCHAR"))

async def init_db():
    async with engine.begin() as conn:
        # Create all tables in the database
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_migrations)
