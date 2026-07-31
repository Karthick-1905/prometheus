"""Site Manager APIs — sites, assignments, QR check-in/out."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.domain import User
from app.schemas.sites import AssignmentCreate, CheckoutScanBody, SiteCreate
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
    require_site_ops,
)
from app.services.sites import SiteService

router = APIRouter(tags=["Sites & Checkout"])


def _principal(
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
) -> DashboardPrincipal:
    require_site_ops(principal)
    return principal


def _resolve_actor_user_id(
    db: Session,
    principal: DashboardPrincipal,
    *,
    explicit: Optional[int] = None,
    x_user_id: Optional[int] = None,
) -> int:
    if explicit is not None:
        return explicit
    if x_user_id is not None:
        return x_user_id
    # Prefer first company user (seeded fleet user works for site ops demos)
    stmt = select(User)
    if principal.company_id is not None:
        stmt = stmt.where(User.company_id == principal.company_id)
    stmt = stmt.order_by(User.user_id).limit(1)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=400,
            detail="No company user found for checkout actor; seed a User or pass actorUserId",
        )
    return user.user_id


@router.get("/api/v1/sites")
def list_sites(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    sites = SiteService.list_sites(db, company_id=principal.company_id)
    return {"success": True, "data": sites, "meta": {"total": len(sites)}}


@router.post("/api/v1/sites")
def create_site(
    body: SiteCreate,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    if not principal.is_fleet_manager and principal.role.value not in {
        "SITE_MANAGER",
        "SYSTEM_ADMINISTRATOR",
    }:
        # operators cannot create sites
        if principal.role.value == "OPERATOR":
            raise HTTPException(status_code=403, detail="Operators cannot create sites")
    company_id = body.companyId or principal.company_id
    if company_id is None:
        raise HTTPException(status_code=422, detail="companyId required")
    site = SiteService.create_site(
        db,
        company_id=company_id,
        site_name=body.siteName,
        location=body.location,
        latitude=body.latitude,
        longitude=body.longitude,
        status=body.status,
    )
    return {"success": True, "data": site}


@router.get("/api/v1/sites/{site_id}")
def get_site(
    site_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    site = SiteService.get_site(db, site_id, company_id=principal.company_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return {"success": True, "data": site}


@router.get("/api/v1/sites/{site_id}/summary")
def site_summary(
    site_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {
        "success": True,
        "data": SiteService.site_summary(db, site_id, company_id=principal.company_id),
    }


@router.get("/api/v1/sites/{site_id}/equipment")
def site_equipment(
    site_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    site = SiteService.get_site(db, site_id, company_id=principal.company_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    rows = SiteService.list_active_assignments(
        db, site_id=site_id, company_id=principal.company_id
    )
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}


@router.get("/api/v1/assignments")
def list_assignments(
    siteId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    site_id = siteId if siteId is not None else principal.site_id
    rows = SiteService.list_active_assignments(
        db, site_id=site_id, company_id=principal.company_id
    )
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}


@router.get("/api/v1/operators")
def list_operators(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    rows = SiteService.list_operators(db, company_id=principal.company_id)
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}


@router.post("/api/v1/assignments")
def create_assignment(
    body: AssignmentCreate,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
    x_user_id: Optional[int] = Header(default=None),
):
    actor = _resolve_actor_user_id(db, principal, x_user_id=x_user_id)
    row = SiteService.create_assignment(
        db,
        contract_id=body.contractId,
        site_id=body.siteId,
        actor_user_id=actor,
        company_id=principal.company_id,
    )
    return {"success": True, "data": row}


@router.get("/api/v1/equipment/by-qr/{qr_code}")
def equipment_by_qr(
    qr_code: str,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {"success": True, "data": SiteService.equipment_by_qr(db, qr_code)}


@router.get("/api/v1/equipment/by-rfid/{rfid_tag}")
def equipment_by_rfid(
    rfid_tag: str,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    return {"success": True, "data": SiteService.equipment_by_rfid(db, rfid_tag)}


@router.post("/api/v1/checkouts/scan")
def checkout_scan(
    body: CheckoutScanBody,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
    x_user_id: Optional[int] = Header(default=None),
):
    if not body.qrCode and not body.rfidTag and body.equipmentId is None:
        raise HTTPException(
            status_code=422,
            detail="Provide qrCode, rfidTag, or equipmentId",
        )
    actor = _resolve_actor_user_id(
        db, principal, explicit=body.actorUserId, x_user_id=x_user_id
    )
    result = SiteService.scan_checkout(
        db,
        action=body.action,
        site_id=body.siteId,
        actor_user_id=actor,
        company_id=principal.company_id,
        qr_code=body.qrCode,
        rfid_tag=body.rfidTag,
        equipment_id=body.equipmentId,
        operator_id=body.operatorId,
    )
    return {"success": True, "data": result}


@router.get("/api/v1/checkouts/active")
def active_checkouts(
    siteId: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    site_id = siteId if siteId is not None else principal.site_id
    rows = SiteService.list_active_assignments(
        db, site_id=site_id, company_id=principal.company_id
    )
    return {"success": True, "data": rows, "meta": {"total": len(rows)}}
