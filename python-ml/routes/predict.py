"""
routes/predict.py
-----------------
POST /predict — Score a live telemetry feature vector against the
                trained Isolation Forest model.
"""

from fastapi import APIRouter, HTTPException
from schemas.telemetry import FeatureVector, PredictResponse
from model import predictor

router = APIRouter()


@router.post("/predict", response_model=PredictResponse, tags=["Inference"])
def predict(body: FeatureVector):
    """
    Score a single telemetry feature vector.

    Accepts the 14-dimensional feature vector from the TypeScript
    `buildFeatureVector()` function and returns an anomaly score.

    - **isAnomaly**: True if the model classifies the packet as an outlier
    - **anomalyScore**: Normalized score in [0, 1]. Higher = more anomalous
    - **confidence**: LOW / MEDIUM / HIGH based on score magnitude
    """
    if not predictor.is_loaded():
        raise HTTPException(
            status_code=503,
            detail=(
                "Model not loaded. Train the model first via POST /train, "
                "or ensure annomoly/isolation_forest.joblib exists on startup."
            ),
        )

    # Build 6-element vector in the exact FEATURE_NAMES order
    vector = [
        body.engineHoursPerDay,
        body.idleHoursPerDay,
        body.rentalDays,
        body.hasOperator,
        body.hasSite,
        body.idleRatio,
    ]

    is_anomaly, anomaly_score, confidence = predictor.score(vector)

    message = (
        f"Statistical outlier detected for {body.equipmentId or 'equipment'} "
        f"(score={anomaly_score:.3f}, confidence={confidence}). "
        "Usage pattern deviates from learned normal operating envelope."
        if is_anomaly else
        f"Normal operating pattern (score={anomaly_score:.3f})."
    )

    return PredictResponse(
        equipmentId=body.equipmentId,
        isAnomaly=is_anomaly,
        anomalyScore=anomaly_score,
        confidence=confidence,
        message=message,
    )
