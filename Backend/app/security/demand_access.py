"""Forecast-specific role and tenant context.

Demand APIs accept the dashboard Bearer JWT in every environment. The legacy
header-backed principal remains available only in development/demo mode.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from fastapi import Header, HTTPException

from app.config import get_settings
from app.security.jwt_tokens import TokenError, decode_access_token


class ForecastRole(str, Enum):
    CUSTOMER_PROJECT_MANAGER = "CUSTOMER_PROJECT_MANAGER"
    CUSTOMER_SITE_ENGINEER = "CUSTOMER_SITE_ENGINEER"
    DEALER_MANAGER = "DEALER_MANAGER"
    FLEET_MANAGER = "FLEET_MANAGER"
    SYSTEM_ADMINISTRATOR = "SYSTEM_ADMINISTRATOR"


@dataclass(frozen=True)
class Principal:
    actor_id: str
    role: ForecastRole
    company_id: Optional[int]
    dealer_id: Optional[int]

    @property
    def is_customer(self) -> bool:
        return self.role in {
            ForecastRole.CUSTOMER_PROJECT_MANAGER,
            ForecastRole.CUSTOMER_SITE_ENGINEER,
        }

    @property
    def is_dealer(self) -> bool:
        return self.role in {ForecastRole.DEALER_MANAGER, ForecastRole.FLEET_MANAGER}


def _positive_scope_id(payload: dict, claim: str) -> Optional[int]:
    value = payload.get(claim)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise HTTPException(status_code=403, detail=f"Invalid {claim} scope")
    return value


def _from_bearer(authorization: str) -> Principal:
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
    except TokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    raw_role = str(payload.get("role") or "").strip().upper()
    role_map = {
        "FLEET_MANAGER": ForecastRole.CUSTOMER_PROJECT_MANAGER,
        "SITE_MANAGER": ForecastRole.CUSTOMER_PROJECT_MANAGER,
        "SITE_ENGINEER": ForecastRole.CUSTOMER_SITE_ENGINEER,
        "CUSTOMER_PROJECT_MANAGER": ForecastRole.CUSTOMER_PROJECT_MANAGER,
        "CUSTOMER_SITE_ENGINEER": ForecastRole.CUSTOMER_SITE_ENGINEER,
        "DEALER": ForecastRole.DEALER_MANAGER,
        "DEALER_MANAGER": ForecastRole.DEALER_MANAGER,
        "SYSTEM_ADMINISTRATOR": ForecastRole.SYSTEM_ADMINISTRATOR,
    }
    role = role_map.get(raw_role)
    if role is None:
        raise HTTPException(status_code=403, detail="Unsupported demand role")

    principal = Principal(
        actor_id=str(payload.get("sub") or "jwt-user"),
        role=role,
        company_id=_positive_scope_id(payload, "company_id"),
        dealer_id=_positive_scope_id(payload, "dealer_id"),
    )
    if principal.is_customer and principal.company_id is None:
        raise HTTPException(status_code=403, detail="Company scope required for this role")
    if principal.is_dealer and principal.dealer_id is None:
        raise HTTPException(status_code=403, detail="Dealer scope required for this role")
    return principal


def get_demand_principal(
    authorization: Optional[str] = Header(default=None),
    x_actor_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
    x_company_id: Optional[int] = Header(default=None),
    x_dealer_id: Optional[int] = Header(default=None),
) -> Principal:
    if authorization and authorization.lower().startswith("bearer "):
        return _from_bearer(authorization)

    settings = get_settings()
    if settings.is_production or not settings.demand_demo_auth_enabled:
        raise HTTPException(
            status_code=401,
            detail="Authorization Bearer token required",
        )
    try:
        role = ForecastRole(x_user_role or ForecastRole.CUSTOMER_PROJECT_MANAGER.value)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Unsupported demand role") from exc
    return Principal(
        actor_id=x_actor_id or "demo-user",
        role=role,
        company_id=x_company_id if x_company_id is not None else (None if role in {
            ForecastRole.DEALER_MANAGER,
            ForecastRole.FLEET_MANAGER,
            ForecastRole.SYSTEM_ADMINISTRATOR,
        } else 1),
        dealer_id=x_dealer_id if x_dealer_id is not None else (1 if role in {
            ForecastRole.DEALER_MANAGER,
            ForecastRole.FLEET_MANAGER,
        } else None),
    )


def ensure_customer_access(principal: Principal, customer_id: int) -> None:
    if principal.role == ForecastRole.SYSTEM_ADMINISTRATOR:
        return
    if not principal.is_customer or principal.company_id != customer_id:
        raise HTTPException(status_code=403, detail="Project is outside your customer scope")


def ensure_dealer_access(principal: Principal) -> None:
    if principal.role == ForecastRole.SYSTEM_ADMINISTRATOR:
        return
    if not principal.is_dealer:
        raise HTTPException(status_code=403, detail="Dealer or fleet-manager role required")
