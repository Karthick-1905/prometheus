from fastapi import APIRouter

from app.config import get_settings
from app.services.anomaly_detection.predictor import predictor
from app.services.demand_forecasting import demand_service

router = APIRouter(tags=["System"])


@router.get("/")
def root():
    s = get_settings()
    return {
        "service": s.app_name,
        "version": s.app_version,
        "endpoints": {
            "health": "GET /health",
            "predict": "POST /api/ml/predict",
            "train": "POST /api/ml/train",
            "model_status": "GET /api/ml/status",
            "alerts": "GET /api/alerts",
            "alerts_v1": "GET /api/v1/alerts",
            "telemetry": "GET /api/telemetry",
            "simulate": "POST /api/simulate",
            "demand": "GET /api/demand/status",
            "fleet_overview": "GET /api/v1/fleet/overview",
            "fleet_machines": "GET /api/v1/fleet/machines",
            "auth_me": "GET /api/v1/auth/me",
            "auth_login": "POST /api/v1/auth/login",
            "sites": "GET /api/v1/sites",
            "checkout_scan": "POST /api/v1/checkouts/scan",
            "dealers_equipment": "GET /api/v1/dealers/equipment",
            "live_fleet": "GET /api/v1/live/fleet",
            "docs": "GET /docs",
        },
    }


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": get_settings().app_name,
        "model_loaded": predictor.is_loaded(),
        "model_meta": predictor.get_meta(),
        "demand_forecasting": demand_service.status(),
    }
