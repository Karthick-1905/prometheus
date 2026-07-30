"""In-app notifications + rental email dispatch."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
)
from app.services.notifications import NotificationService

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(
    unreadOnly: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    rows = NotificationService.list_notifications(
        db,
        company_id=principal.company_id,
        unread_only=unreadOnly,
        limit=limit,
    )
    unread = NotificationService.unread_count(db, company_id=principal.company_id)
    return {
        "success": True,
        "data": rows,
        "meta": {"total": len(rows), "unread": unread},
    }


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    count = NotificationService.unread_count(db, company_id=principal.company_id)
    return {"success": True, "data": {"unread": count}}


@router.post("/scan")
def scan_and_dispatch(
    endingSoonDays: Optional[int] = Query(None, ge=1, le=30),
    sendEmail: bool = Query(True),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    """Scan expiring / overdue rentals, create notifications, send emails."""
    result = NotificationService.scan_rental_events(
        db,
        company_id=principal.company_id,
        ending_soon_days=endingSoonDays,
        send_email=sendEmail,
    )
    return {"success": True, "data": result}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    row = NotificationService.mark_read(
        db, notification_id, company_id=principal.company_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True, "data": row}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    count = NotificationService.mark_all_read(db, company_id=principal.company_id)
    return {"success": True, "data": {"marked": count}}
