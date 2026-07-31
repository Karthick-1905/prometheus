"""Fleet Manager dashboard APIs (Phase 1).

Does not alter demand forecasting routes under /api/demand.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
    require_fleet_access,
)
from app.services.fleet import FleetService

router = APIRouter(prefix="/api/v1/fleet", tags=["Fleet Manager"])


def _principal(
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
) -> DashboardPrincipal:
    require_fleet_access(principal)
    return principal


@router.get("/overview")
def fleet_overview(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    company_id = principal.company_id
    return FleetService.overview(db, company_id=company_id)


@router.get("/machines")
def list_machines(
    liveStatus: Optional[str] = Query(None),
    siteId: Optional[int] = Query(None),
    equipmentType: Optional[str] = Query(None),
    rentalStatus: Optional[str] = Query(None),
    hasAlert: Optional[bool] = Query(None),
    unassigned: bool = Query(False),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    site_id = siteId if siteId is not None else principal.site_id
    machines = FleetService.list_machines(
        db,
        company_id=principal.company_id,
        site_id=site_id,
        live_status=liveStatus,
        equipment_type=equipmentType,
        rental_status=rentalStatus,
        has_alert=hasAlert,
        unassigned_only=unassigned,
        q=q,
        limit=limit,
    )
    return {
        "success": True,
        "data": machines,
        "meta": {"total": len(machines), "limit": limit},
    }


@router.get("/machines/{equipment_id}")
def machine_detail(
    equipment_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    row = FleetService.machine_detail(
        db, equipment_id, company_id=principal.company_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Equipment not found in fleet")
    return {"success": True, "data": row}


@router.get("/machines/{equipment_id}/telemetry")
def machine_telemetry(
    equipment_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    # Ensure machine is in company fleet when company scoped
    detail = FleetService.machine_detail(
        db, equipment_id, company_id=principal.company_id
    )
    if not detail:
        raise HTTPException(status_code=404, detail="Equipment not found in fleet")
    history = FleetService.telemetry_history(db, equipment_id, limit=limit)
    return {"success": True, "data": history, "meta": {"total": len(history)}}


@router.get("/machines/{equipment_id}/alerts")
def machine_alerts(
    equipment_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    detail = FleetService.machine_detail(
        db, equipment_id, company_id=principal.company_id
    )
    if not detail:
        raise HTTPException(status_code=404, detail="Equipment not found in fleet")
    alerts = FleetService.alerts_for_equipment(
        db,
        str(equipment_id),
        company_id=principal.company_id,
        limit=limit,
    )
    return {"success": True, "data": alerts}


@router.get("/map")
def fleet_map(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    pins = FleetService.map_pins(db, company_id=principal.company_id)
    return {"success": True, "data": pins, "meta": {"total": len(pins)}}


@router.get("/sites")
def fleet_sites(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    sites = FleetService.fleet_sites(db, company_id=principal.company_id)
    return {"success": True, "data": sites}


@router.get("/unassigned")
def fleet_unassigned(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = FleetService.unassigned(db, company_id=principal.company_id)
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}


@router.get("/logs")
def fleet_logs(
    equipmentId: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    logs = FleetService.live_logs(
        db,
        company_id=principal.company_id,
        equipment_id=equipmentId,
        limit=limit,
    )
    return {"success": True, "data": logs, "meta": {"total": len(logs)}}
