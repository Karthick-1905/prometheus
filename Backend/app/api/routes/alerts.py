"""Anomaly alert list / resolve APIs.

Keeps legacy paths:
  GET  /api/alerts
  PATCH /api/alerts  { alertId }

Adds:
  GET  /api/alerts/summary
  GET  /api/v1/alerts
  GET  /api/v1/alerts/summary
  POST /api/v1/alerts/{alertId}/resolve
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.domain import AnomalyAlert
from app.schemas.telemetry import ResolveAlertBody

router = APIRouter(tags=["Alerts"])


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


def _list_alerts(
    db: Session,
    *,
    resolved: Optional[bool],
    severity: Optional[str],
    equipment_id: Optional[str],
    limit: int,
) -> list[AnomalyAlert]:
    stmt = select(AnomalyAlert).order_by(AnomalyAlert.detected_at.desc()).limit(limit)
    if resolved is not None:
        stmt = stmt.where(AnomalyAlert.is_resolved == resolved)
    if severity:
        stmt = stmt.where(AnomalyAlert.severity == severity)
    if equipment_id:
        stmt = stmt.where(AnomalyAlert.equipment_id == str(equipment_id))
    return list(db.execute(stmt).scalars().all())


def _summary(db: Session) -> dict:
    open_rows = db.execute(
        select(AnomalyAlert.severity, func.count())
        .where(AnomalyAlert.is_resolved.is_(False))
        .group_by(AnomalyAlert.severity)
    ).all()
    by_severity = {
        (s.value if hasattr(s, "value") else str(s)): c for s, c in open_rows
    }
    total_open = sum(by_severity.values())
    total_resolved = db.execute(
        select(func.count()).select_from(AnomalyAlert).where(AnomalyAlert.is_resolved.is_(True))
    ).scalar_one()
    return {
        "open": total_open,
        "resolved": int(total_resolved or 0),
        "bySeverity": by_severity,
        "critical": by_severity.get("CRITICAL", 0),
        "warning": by_severity.get("WARNING", 0),
        "info": by_severity.get("INFO", 0),
    }


# ── Legacy routes (backward compatible) ───────────────────────────

@router.get("/api/alerts")
def list_alerts_legacy(
    resolved: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    try:
        rows = _list_alerts(db, resolved=resolved, severity=None, equipment_id=None, limit=limit)
        return {"success": True, "alerts": [_alert_dict(a) for a in rows]}
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e), "alerts": []}


@router.patch("/api/alerts")
def resolve_alert_legacy(body: ResolveAlertBody, db: Session = Depends(get_db)):
    alert = db.get(AnomalyAlert, body.alertId)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return {"success": True, "alert": _alert_dict(alert)}


@router.get("/api/alerts/summary")
def alerts_summary_legacy(db: Session = Depends(get_db)):
    try:
        return {"success": True, **_summary(db)}
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e)}


# ── v1 routes ─────────────────────────────────────────────────────

@router.get("/api/v1/alerts")
def list_alerts_v1(
    resolved: Optional[bool] = Query(False),
    severity: Optional[str] = Query(None),
    equipmentId: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    try:
        rows = _list_alerts(
            db,
            resolved=resolved,
            severity=severity,
            equipment_id=equipmentId,
            limit=limit,
        )
        return {
            "success": True,
            "data": [_alert_dict(a) for a in rows],
            "meta": {"total": len(rows), "limit": limit},
        }
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e), "data": []}


@router.get("/api/v1/alerts/summary")
def alerts_summary_v1(db: Session = Depends(get_db)):
    try:
        return {"success": True, **_summary(db)}
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e)}


@router.get("/api/v1/alerts/{alert_id}")
def get_alert_v1(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(AnomalyAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "data": _alert_dict(alert)}


@router.post("/api/v1/alerts/{alert_id}/resolve")
def resolve_alert_v1(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(AnomalyAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return {"success": True, "data": _alert_dict(alert)}
