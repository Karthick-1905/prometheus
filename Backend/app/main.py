"""
CAT Smart Rental — FastAPI backend
Run from Backend/:
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    alerts,
    auth,
    contracts,
    dealers,
    demand,
    fleet,
    health,
    live,
    ml,
    simulate,
    sites,
    telemetry,
)
from app.config import get_settings
from app.services.anomaly_detection.predictor import predictor


@asynccontextmanager
async def lifespan(_app: FastAPI):
    loaded = predictor.load_model()
    if not loaded:
        print(
            "WARNING: No Isolation Forest artifacts in Backend/artifacts/.\n"
            "  POST /api/ml/train  or place isolation_forest.joblib + scaler.joblib"
        )
    yield
    print("Backend shutting down.")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Unified FastAPI backend: hybrid anomaly detection (rules + Isolation Forest), "
            "fleet dashboard APIs, telemetry ingestion, alerts, and demand forecasting.\n\n"
            "DB: Neon PostgreSQL via SQLAlchemy + Alembic."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Existing routes (unchanged prefixes for demand / ml / simulate)
    app.include_router(health.router)
    app.include_router(ml.router)
    app.include_router(alerts.router)
    app.include_router(telemetry.router)
    app.include_router(simulate.router)
    app.include_router(demand.router)  # demand forecasting — do not reorder carelessly
    # Dashboard APIs (fleet / site / dealer / live) — demand router above is untouched
    app.include_router(auth.router)
    app.include_router(fleet.router)
    app.include_router(contracts.router)
    app.include_router(sites.router)
    app.include_router(dealers.router)
    app.include_router(live.router)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
