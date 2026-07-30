from fastapi import APIRouter, HTTPException

from app.schemas.telemetry import FeatureVector, PredictResponse, TrainRequest, TrainResponse
from app.services.anomaly_detection.service import AnomalyDetectionService
from app.services.anomaly_detection.predictor import predictor
from app.services.anomaly_detection import trainer

router = APIRouter(prefix="/api/ml", tags=["ML"])


@router.get("/health")
def ml_health():
    return {
        "reachable": True,
        "status": "ok",
        "model_loaded": predictor.is_loaded(),
        "model_meta": predictor.get_meta(),
    }


@router.get("/status")
def model_status():
    meta = predictor.get_meta() or {}
    return {
        "success": True,
        "loaded": predictor.is_loaded(),
        "model_path": str(predictor.model_path),
        "trained_at": meta.get("trained_at"),
        "n_estimators": meta.get("n_estimators"),
        "contamination": meta.get("contamination"),
        "n_training_samples": meta.get("n_samples"),
    }


@router.post("/predict")
def predict(body: FeatureVector):
    if not predictor.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded. POST /api/ml/train first.")
    result = AnomalyDetectionService.predict_vector(body.model_dump())
    return {"success": True, "result": result}


@router.post("/train", response_model=TrainResponse)
def train_model(body: TrainRequest):
    try:
        _clf, _scaler, meta = trainer.train(
            csv_path=body.csv_path,
            n_estimators=body.n_estimators,
            contamination=body.contamination,
            random_state=body.random_state,
        )
        predictor.reload_model()
        return TrainResponse(
            success=True,
            message=f"Model trained on {meta['n_samples']} samples and loaded.",
            n_samples=meta["n_samples"],
            n_estimators=meta["n_estimators"],
            contamination=float(meta["contamination"]),
            model_path=str(trainer.model_path()),
            training_time_ms=meta["training_time_ms"],
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
