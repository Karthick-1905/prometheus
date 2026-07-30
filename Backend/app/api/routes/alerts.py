from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.domain import AnomalyAlert
from app.schemas.telemetry import ResolveAlertBody

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


def _alert_dict(a: AnomalyAlert) -> dict:
    return {
        "alertId": a.alert_id,
        "equipmentId": a.equipment_id,
        "equipmentType": a.equipment_type,
        "siteId": a.site_id,
        "operatorId": a.operator_id,
        "anomalyType": a.anomaly_type.value if a.anomaly_type else None,
        "severity": a.severity.value if a.severity else None,
        "description": a.description,
        "recommendation": a.recommendation,
        "triggerValue": a.trigger_value,
        "thresholdValue": a.threshold_value,
        "isResolved": a.is_resolved,
        "resolvedAt": a.resolved_at.isoformat() if a.resolved_at else None,
        "detectedAt": a.detected_at.isoformat() if a.detected_at else None,
    }


@router.get("")
def list_alerts(
    resolved: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    try:
        stmt = (
            select(AnomalyAlert)
            .where(AnomalyAlert.is_resolved == resolved)
            .order_by(AnomalyAlert.detected_at.desc())
            .limit(limit)
        )
        rows = db.execute(stmt).scalars().all()
        return {"success": True, "alerts": [_alert_dict(a) for a in rows]}
    except Exception as e:
        return {"success": False, "error": str(e), "alerts": []}


@router.patch("")
def resolve_alert(body: ResolveAlertBody, db: Session = Depends(get_db)):
    alert = db.get(AnomalyAlert, body.alertId)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return {"success": True, "alert": _alert_dict(alert)}
