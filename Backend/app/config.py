"""Application settings (env / Neon DATABASE_URL)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://user:pass@localhost:5432/cat"
    app_name: str = "CAT Smart Rental API"
    app_version: str = "2.0.0"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    log_level: str = "info"
    artifacts_dir: str = str(ARTIFACTS_DIR)
    environment: str = "development"
    demand_data_mode: str = "synthetic"
    demand_demo_auth_enabled: bool = True
    demand_synthetic_seed: int = 20260730
    demand_model_dir: str = str(ARTIFACTS_DIR / "demand_forecasting")

    # Redis — pub/sub bus between ingestion and anomaly detection
    # docker-compose maps container :6379 → host :6380
    redis_url: str = "redis://localhost:6380/0"
    redis_telemetry_channel: str = "telemetry:events"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """Normalize postgres URLs for SQLAlchemy + psycopg2."""
        url = self.database_url
        if url.startswith("postgresql+psycopg2://"):
            return url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
