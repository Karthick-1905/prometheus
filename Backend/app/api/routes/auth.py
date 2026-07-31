"""Auth / session endpoints — JWT login + demo headers fallback."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.models.domain import Dealer, User
from app.schemas.auth import LoginRequest
from app.security.dashboard_access import (
    DashboardPrincipal,
    _parse_role,
    get_dashboard_principal,
)
from app.security.jwt_tokens import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def _user_payload(principal: DashboardPrincipal) -> dict:
    return {
        "actorId": principal.actor_id,
        "role": principal.role.value,
        "companyId": principal.company_id,
        "dealerId": principal.dealer_id,
        "siteId": principal.site_id,
        "authMode": principal.auth_mode,
        "permissions": {
            "fleetDashboard": principal.is_fleet_manager or principal.is_site_ops,
            "demandDealer": principal.is_dealer or principal.is_fleet_manager,
            "isFleetManager": principal.is_fleet_manager,
            "isSiteOps": principal.is_site_ops,
            "isDealer": principal.is_dealer,
        },
    }


@router.get("/me")
def me(principal: DashboardPrincipal = Depends(get_dashboard_principal)):
    return {"success": True, "user": _user_payload(principal)}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Issue a JWT for dashboard clients.

    Demo mode: any password works; role/company/dealer come from the body
    (defaults align with header-based demo auth).
    """
    settings = get_settings()
    actor_id = body.actorId or body.email
    role = body.role.strip().upper()

    company_id = body.companyId
    dealer_id = body.dealerId
    normalized_email = body.email.strip().lower()
    if role in {
        "FLEET_MANAGER",
        "SITE_MANAGER",
        "SITE_ENGINEER",
        "OPERATOR",
    }:
        matched_user = db.execute(
            select(User)
            .where(User.email.is_not(None), func.lower(User.email) == normalized_email)
            .limit(1)
        ).scalar_one_or_none()
        if matched_user is not None:
            company_id = matched_user.company_id
    elif role in {"DEALER", "DEALER_MANAGER"}:
        matched_dealer = db.execute(
            select(Dealer)
            .where(
                Dealer.email.is_not(None),
                func.lower(Dealer.email) == normalized_email,
            )
            .limit(1)
        ).scalar_one_or_none()
        if matched_dealer is not None:
            dealer_id = matched_dealer.dealer_id

    if company_id is None and role in {
        "FLEET_MANAGER",
        "SITE_MANAGER",
        "SITE_ENGINEER",
        "OPERATOR",
    }:
        company_id = 1
    if dealer_id is None and role in {"DEALER", "DEALER_MANAGER"}:
        dealer_id = 1

    token = create_access_token(
        subject=actor_id,
        role=role,
        company_id=company_id,
        dealer_id=dealer_id,
        site_id=body.siteId,
        extra={"email": body.email},
    )
    principal = DashboardPrincipal(
        actor_id=actor_id,
        role=_parse_role(role),
        company_id=company_id,
        dealer_id=dealer_id,
        site_id=body.siteId,
        auth_mode="jwt",
    )
    return {
        "success": True,
        "accessToken": token,
        "tokenType": "bearer",
        "expiresInMinutes": settings.jwt_expire_minutes,
        "user": _user_payload(principal),
        "mode": "jwt",
    }


@router.post("/refresh")
def refresh(principal: DashboardPrincipal = Depends(get_dashboard_principal)):
    """Re-issue access token from a valid Bearer JWT or current demo identity."""
    settings = get_settings()
    token = create_access_token(
        subject=principal.actor_id,
        role=principal.role.value,
        company_id=principal.company_id,
        dealer_id=principal.dealer_id,
        site_id=principal.site_id,
    )
    return {
        "success": True,
        "accessToken": token,
        "tokenType": "bearer",
        "expiresInMinutes": settings.jwt_expire_minutes,
        "user": _user_payload(
            DashboardPrincipal(
                actor_id=principal.actor_id,
                role=principal.role,
                company_id=principal.company_id,
                dealer_id=principal.dealer_id,
                site_id=principal.site_id,
                auth_mode="jwt",
            )
        ),
    }
