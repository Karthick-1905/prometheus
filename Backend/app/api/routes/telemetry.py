from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.domain import (
    EquipmentAssignment,
    EquipmentTelemetry,
    ProjectSite,
    RentalContract,
    UsageLog,
)

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])


@router.get("")
def fleet_snapshot(db: Session = Depends(get_db)):
    """Latest usage/telemetry snapshot for fleet grid."""
    try:
        # Prefer UsageLog path (matches old Next.js API)
        stmt = (
            select(UsageLog)
            .options(
                joinedload(UsageLog.assignment)
                .joinedload(EquipmentAssignment.contract)
                .joinedload(RentalContract.equipment),
                joinedload(UsageLog.assignment).joinedload(EquipmentAssignment.site),
            )
            .order_by(UsageLog.recorded_at.desc())
            .limit(500)
        )
        logs = db.execute(stmt).unique().scalars().all()
        seen: set[int] = set()
        snapshot = []
        for log in logs:
            eq = log.assignment.contract.equipment
            if eq.equipment_id in seen:
                continue
            seen.add(eq.equipment_id)
            snapshot.append(
                {
                    "equipmentId": eq.equipment_id,
                    "equipmentType": eq.equipment_type,
                    "status": eq.status.value if eq.status else None,
                    "siteName": log.assignment.site.site_name if log.assignment.site else "Unassigned",
                    "runtimeHours": float(log.runtime_hours) if log.runtime_hours is not None else None,
                    "idleHours": float(log.idle_hours) if log.idle_hours is not None else None,
                    "fuelLevel": float(log.fuel_consumed) if log.fuel_consumed is not None else None,
                    "latitude": float(log.latitude) if log.latitude is not None else None,
                    "longitude": float(log.longitude) if log.longitude is not None else None,
                    "recordedAt": log.recorded_at.isoformat() if log.recorded_at else None,
                }
            )
        if snapshot:
            return {"success": True, "snapshot": snapshot}
    except Exception:
        pass

    # Fallback: latest EquipmentTelemetry per equipment
    try:
        stmt = (
            select(EquipmentTelemetry)
            .options(joinedload(EquipmentTelemetry.equipment))
            .order_by(EquipmentTelemetry.timestamp.desc())
            .limit(500)
        )
        rows = db.execute(stmt).unique().scalars().all()
        seen2: set[int] = set()
        snapshot = []
        for r in rows:
            if r.equipment_id in seen2:
                continue
            seen2.add(r.equipment_id)
            eq = r.equipment
            snapshot.append(
                {
                    "equipmentId": r.equipment_id,
                    "equipmentType": eq.equipment_type if eq else None,
                    "status": eq.status.value if eq and eq.status else None,
                    "siteName": "—",
                    "runtimeHours": float(r.engine_hours) if r.engine_hours is not None else None,
                    "idleHours": float(r.idle_hours) if r.idle_hours is not None else None,
                    "fuelLevel": float(r.fuel_level) if r.fuel_level is not None else None,
                    "latitude": float(r.latitude) if r.latitude is not None else None,
                    "longitude": float(r.longitude) if r.longitude is not None else None,
                    "recordedAt": r.timestamp.isoformat() if r.timestamp else None,
                }
            )
        return {"success": True, "snapshot": snapshot}
    except Exception as e:
        return {"success": False, "error": str(e), "snapshot": []}
