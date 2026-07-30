"""Forecast-specific role and tenant context.

The header-backed principal is deliberately limited to development/demo mode.
Production refuses this mechanism until a real identity provider populates the
same Principal contract.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from fastapi import Header, HTTPException

from app.config import get_settings


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


def get_demand_principal(
    x_actor_id: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None),
    x_company_id: Optional[int] = Header(default=None),
    x_dealer_id: Optional[int] = Header(default=None),
) -> Principal:
    settings = get_settings()
    if settings.is_production or not settings.demand_demo_auth_enabled:
        raise HTTPException(
            status_code=503,
            detail="Demand APIs require production identity-provider integration.",
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
