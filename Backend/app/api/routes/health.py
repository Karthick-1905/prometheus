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
            "telemetry": "GET /api/telemetry",
            "simulate": "POST /api/simulate",
            "demand": "GET /api/demand/status",
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
