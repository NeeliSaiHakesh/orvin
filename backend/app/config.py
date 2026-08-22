from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./automlops.db"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    UPLOAD_DIR: str = "../uploads"
    MODEL_REGISTRY_DIR: str = "../model_registry"
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB
    GEMINI_API_KEY: str = ""
    DEBUG: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
