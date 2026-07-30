"""
routes/train.py
---------------
POST /train  — Train the Isolation Forest from the rental dataset CSV.
GET  /model/status — Returns loaded model metadata.
"""

import os
import time
from fastapi import APIRouter, HTTPException, BackgroundTasks
from schemas.telemetry import TrainRequest, TrainResponse, ModelStatusResponse
from model import predictor, trainer

router = APIRouter()

# Track training state
_training_in_progress = False


@router.get("/model/status", response_model=ModelStatusResponse, tags=["Model"])
def model_status():
    """Returns the currently loaded model's metadata."""
    meta = predictor.get_meta()

    return ModelStatusResponse(
        loaded=predictor.is_loaded(),
        model_path=trainer.MODEL_PATH,
        trained_at=meta.get("trained_at") if meta else None,
        n_estimators=meta.get("n_estimators") if meta else None,
        contamination=meta.get("contamination") if meta else None,
        n_training_samples=meta.get("n_samples") if meta else None,
    )


@router.post("/train", response_model=TrainResponse, tags=["Model"])
def train_model(body: TrainRequest):
    """
    Trains the Isolation Forest on the rental dataset CSV.

    - **csv_path**: Optional path to CSV (defaults to annomoly/training-data.csv)
    - **n_estimators**: Number of isolation trees (default: 100)
    - **contamination**: Expected fraction of anomalies (default: 0.1 = 10%)
    - **random_state**: Reproducibility seed (default: 42)

    After training, the new model is auto-loaded for subsequent /predict calls.
    """
    global _training_in_progress

    if _training_in_progress:
        raise HTTPException(status_code=409, detail="Training already in progress")

    csv_path = body.csv_path or trainer.DEFAULT_CSV

    if not os.path.exists(csv_path):
        raise HTTPException(
            status_code=404,
            detail=f"CSV not found: {csv_path}. Run: npm run seed:data",
        )

    _training_in_progress = True
    try:
        t0 = time.time()

        _clf, _scaler, meta = trainer.train(
            csv_path=csv_path,
            n_estimators=body.n_estimators,
            contamination=body.contamination,
            max_samples=body.max_samples,
            random_state=body.random_state,
        )

        # Hot-reload model into the predictor singleton
        predictor.reload_model()

        elapsed_ms = (time.time() - t0) * 1000

        return TrainResponse(
            success=True,
            message=f"Model trained on {meta['n_samples']} samples and loaded successfully.",
            n_samples=meta["n_samples"],
            n_estimators=meta["n_estimators"],
            contamination=meta["contamination"],
            model_path=trainer.MODEL_PATH,
            training_time_ms=round(elapsed_ms, 2),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _training_in_progress = False
