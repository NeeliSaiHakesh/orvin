import os
from pydantic_settings import BaseSettings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./automlops.db"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: list[str] = ["*"]
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    MODEL_REGISTRY_DIR: str = os.path.join(BASE_DIR, "model_registry")
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB
    GEMINI_API_KEY: str = ""
    DEBUG: bool = True

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure critical directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.MODEL_REGISTRY_DIR, exist_ok=True)
