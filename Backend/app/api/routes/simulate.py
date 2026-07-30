from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.telemetry import TelemetryIn
from app.services.ingestion import IngestionService

router = APIRouter(prefix="/api/simulate", tags=["Simulator"])


@router.post("")
def simulate(body: TelemetryIn, db: Session = Depends(get_db)):
    payload = body.model_dump()
    if payload.get("timestamp") is None:
        from datetime import datetime

        payload["timestamp"] = datetime.utcnow()
    result = IngestionService.process(db, payload)
    return {
        "success": result.get("success", True),
        "mqttPublished": False,
        "result": result,
        "error": result.get("storeError") or result.get("anomalyError"),
    }
