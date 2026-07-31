"""Persistence boundary for demand forecasting workflows."""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class DemandRepository(Protocol):
    """Contract implemented by synthetic and PostgreSQL demand adapters."""

    mode: str

    def list_projects(self, *, tenant_id: int) -> list[dict[str, Any]]: ...

    def demand_history(
        self, *, tenant_id: int, project_id: str
    ) -> list[dict[str, Any]]: ...

    def inventory_snapshot(
        self, *, tenant_id: int, dealer_id: int | None = None
    ) -> list[dict[str, Any]]: ...

    def save_forecast_run(
        self, *, tenant_id: int, run: dict[str, Any]
    ) -> str: ...

    def save_decision(
        self,
        *,
        tenant_id: int,
        actor_id: str,
        forecast_id: str,
        expected_version: int,
        decision: dict[str, Any],
    ) -> dict[str, Any]: ...
