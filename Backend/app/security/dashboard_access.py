"""Dashboard principal resolution: Bearer JWT preferred, else demo X-* headers.

Separate from demand_access so demand forecasting RBAC stays unchanged.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from fastapi import Header, HTTPException

from app.config import get_settings
from app.security.jwt_tokens import TokenError, decode_access_token


class DashboardRole(str, Enum):
    FLEET_MANAGER = "FLEET_MANAGER"
    SITE_MANAGER = "SITE_MANAGER"
    SITE_ENGINEER = "SITE_ENGINEER"
    DEALER = "DEALER"
    DEALER_MANAGER = "DEALER_MANAGER"
    OPERATOR = "OPERATOR"
    SYSTEM_ADMINISTRATOR = "SYSTEM_ADMINISTRATOR"


@dataclass(frozen=True)
class DashboardPrincipal:
    actor_id: str
    role: DashboardRole
    company_id: Optional[int]
    dealer_id: Optional[int]
    site_id: Optional[int] = None
    auth_mode: str = "headers"  # headers | jwt

    @property
    def is_fleet_manager(self) -> bool:
        return self.role in {
            DashboardRole.FLEET_MANAGER,
            DashboardRole.SYSTEM_ADMINISTRATOR,
        }

    @property
    def is_site_ops(self) -> bool:
        return self.role in {
            DashboardRole.SITE_MANAGER,
            DashboardRole.SITE_ENGINEER,
            DashboardRole.OPERATOR,
        }

    @property
    def is_dealer(self) -> bool:
        return self.role in {DashboardRole.DEALER, DashboardRole.DEALER_MANAGER}


def _parse_role(raw: str) -> DashboardRole:
    value = raw.strip().upper()
    if value == "SITE_ENGINEER":
        value = DashboardRole.SITE_ENGINEER.value
    try:
        return DashboardRole(value)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=f"Unsupported dashboard role: {raw}") from exc


def _from_headers(
    *,
    x_actor_id: Optional[str],
    x_user_role: Optional[str],
    x_company_id: Optional[int],
    x_dealer_id: Optional[int],
    x_site_id: Optional[int],
) -> DashboardPrincipal:
    role = _parse_role(x_user_role or DashboardRole.FLEET_MANAGER.value)
    company_id = x_company_id
    dealer_id = x_dealer_id
    if company_id is None and role in {
        DashboardRole.FLEET_MANAGER,
        DashboardRole.SITE_MANAGER,
        DashboardRole.SITE_ENGINEER,
        DashboardRole.OPERATOR,
    }:
        company_id = 1
    if dealer_id is None and role in {DashboardRole.DEALER, DashboardRole.DEALER_MANAGER}:
        dealer_id = 1
    return DashboardPrincipal(
        actor_id=x_actor_id or "demo-user",
        role=role,
        company_id=company_id,
        dealer_id=dealer_id,
        site_id=x_site_id,
        auth_mode="headers",
    )


def get_dashboard_principal(
    authorization: Optional[str] = Header(default=None),
    x_actor_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
    x_company_id: Optional[int] = Header(default=None),
    x_dealer_id: Optional[int] = Header(default=None),
    x_site_id: Optional[int] = Header(default=None),
) -> DashboardPrincipal:
    """Resolve identity: JWT Bearer first, then demo headers (if enabled)."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            payload = decode_access_token(token)
        except TokenError as exc:
            raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
        role = _parse_role(str(payload.get("role") or DashboardRole.FLEET_MANAGER.value))
        return DashboardPrincipal(
            actor_id=str(payload.get("sub") or "jwt-user"),
            role=role,
            company_id=payload.get("company_id"),
            dealer_id=payload.get("dealer_id"),
            site_id=payload.get("site_id"),
            auth_mode="jwt",
        )

    settings = get_settings()
    if settings.is_production and not settings.jwt_demo_auth_enabled:
        raise HTTPException(
            status_code=401,
            detail="Authorization Bearer token required",
        )
    return _from_headers(
        x_actor_id=x_actor_id,
        x_user_role=x_user_role,
        x_company_id=x_company_id,
        x_dealer_id=x_dealer_id,
        x_site_id=x_site_id,
    )


def require_fleet_access(principal: DashboardPrincipal) -> None:
    if principal.is_fleet_manager or principal.role == DashboardRole.SYSTEM_ADMINISTRATOR:
        return
    if principal.is_site_ops:
        return
    raise HTTPException(status_code=403, detail="Fleet or site role required")


def require_site_ops(principal: DashboardPrincipal) -> None:
    if principal.is_fleet_manager or principal.is_site_ops:
        return
    raise HTTPException(status_code=403, detail="Site manager / fleet role required")


def require_dealer(principal: DashboardPrincipal) -> None:
    if principal.is_dealer or principal.role == DashboardRole.SYSTEM_ADMINISTRATOR:
        return
    raise HTTPException(status_code=403, detail="Dealer role required")
