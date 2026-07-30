"""
routes/health.py
"""
from fastapi import APIRouter
from model import predictor

router = APIRouter()


@router.get("/health", tags=["System"])
def health_check():
    """Returns server health and model status."""
    return {
        "status":       "ok",
        "service":      "CAT Fleet ML — Isolation Forest",
        "model_loaded": predictor.is_loaded(),
        "model_meta":   predictor.get_meta(),
    }
