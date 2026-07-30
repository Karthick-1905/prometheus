"""Fleet analytics APIs — usage + utilization for dashboard widgets."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
    require_fleet_access,
)
from app.services.analytics import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


def _principal(
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
) -> DashboardPrincipal:
    require_fleet_access(principal)
    return principal


@router.get("/usage/summary")
def usage_summary(
    days: int = Query(7, ge=1, le=90, description="Lookback window in days"),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    """Fleet-wide runtime / idle / fuel / downtime totals."""
    data = AnalyticsService.usage_summary(
        db, company_id=principal.company_id, days=days
    )
    return {"success": True, "data": data}


@router.get("/usage/by-site")
def usage_by_site(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = AnalyticsService.usage_by_site(
        db, company_id=principal.company_id, days=days
    )
    return {"success": True, "data": rows, "meta": {"days": days, "total": len(rows)}}


@router.get("/usage/by-equipment")
def usage_by_equipment(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = AnalyticsService.usage_by_equipment(
        db, company_id=principal.company_id, days=days
    )
    return {"success": True, "data": rows, "meta": {"days": days, "total": len(rows)}}


@router.get("/usage/by-type")
def usage_by_type(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = AnalyticsService.usage_by_type(
        db, company_id=principal.company_id, days=days
    )
    return {"success": True, "data": rows, "meta": {"days": days, "total": len(rows)}}


@router.get("/utilization")
def utilization(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    """Fleet utilization % + per-machine ranking (HLD last-7-days input)."""
    data = AnalyticsService.utilization(
        db, company_id=principal.company_id, days=days
    )
    return {"success": True, "data": data}


@router.get("/underutilized")
def underutilized(
    days: int = Query(7, ge=1, le=90),
    threshold: float = Query(
        0.35,
        ge=0.0,
        le=1.0,
        description="Flag machines with utilization below this ratio (0–1)",
    ),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    """Under-utilized assets for reallocation / demand pre-positioning."""
    rows = AnalyticsService.underutilized(
        db,
        company_id=principal.company_id,
        days=days,
        threshold=threshold,
    )
    return {
        "success": True,
        "data": rows,
        "meta": {
            "days": days,
            "threshold": threshold,
            "thresholdPct": round(threshold * 100, 1),
            "total": len(rows),
        },
    }
