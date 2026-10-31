from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 1. Database URL (defaults to local SQLite)
    DATABASE_URL: str = "sqlite:///./bookleaf.db"

    # 2. JWT Authentication & Session Security
    JWT_SECRET_KEY: str = "bookleaf-dev-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # 3. AI / LLM Configuration (Loaded strictly from environment variables)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MODEL: str = "llama-3.1-8b-instant"

    # Instructs Pydantic to automatically load values from backend/.env
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# Singleton settings instance imported across the application
settings = Settings()