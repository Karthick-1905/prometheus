"""
Demand forecasting service (placeholder).

Future: time-series models for rental demand by equipment type / region.
"""
from __future__ import annotations

from typing import Any


class DemandForecastingService:
    """Scaffold for demand forecasting — not yet trained."""

    @staticmethod
    def status() -> dict[str, Any]:
        return {
            "service": "demand-forecasting",
            "ready": False,
            "message": "Scaffold only. Add training data + model under services/demand_forecasting/.",
        }

    @staticmethod
    def forecast(equipment_type: str, horizon_days: int = 7) -> dict[str, Any]:
        return {
            "equipmentType": equipment_type,
            "horizonDays": horizon_days,
            "forecast": [],
            "message": "Not implemented yet",
        }
