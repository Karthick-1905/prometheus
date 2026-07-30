"""Company-side rental contract views for Fleet Manager."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
    require_fleet_access,
)
from app.services.fleet import FleetService

router = APIRouter(prefix="/api/v1/contracts", tags=["Contracts"])


def _principal(
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
) -> DashboardPrincipal:
    require_fleet_access(principal)
    return principal


@router.get("/expiring")
def expiring(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = FleetService.contracts_expiring(
        db, company_id=principal.company_id, days=days
    )
    return {"success": True, "data": rows, "meta": {"days": days, "total": len(rows)}}


@router.get("/overdue")
def overdue(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = FleetService.contracts_overdue(db, company_id=principal.company_id)
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}
