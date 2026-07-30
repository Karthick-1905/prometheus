"""Derive live machine status for Fleet Manager dashboard."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from app.models.enums import EquipmentStatus, RentalContractStatus

STALE_AFTER = timedelta(minutes=15)


def derive_live_status(
    *,
    equipment_status: Optional[EquipmentStatus | str],
    rental_status: Optional[RentalContractStatus | str],
    engine_status: Optional[str],
    speed: Optional[float],
    load_percentage: Optional[float],
    last_seen_at: Optional[datetime],
    open_alert_count: int,
    highest_severity: Optional[str],
    now: Optional[datetime] = None,
) -> str:
    """
    Priority:
      MAINTENANCE > OVERDUE > ALERT(CRITICAL/WARNING) > STALE > WORKING/IDLE/OFF/AVAILABLE
    """
    now = now or datetime.utcnow()

    eq_status = _enum_val(equipment_status)
    rent_status = _enum_val(rental_status)

    if eq_status == EquipmentStatus.MAINTENANCE.value:
        return "MAINTENANCE"

    if rent_status == RentalContractStatus.OVERDUE.value:
        return "OVERDUE"

    if open_alert_count > 0 and highest_severity in {"CRITICAL", "WARNING"}:
        return "ALERT"

    if last_seen_at is None or (now - last_seen_at) > STALE_AFTER:
        if eq_status == EquipmentStatus.AVAILABLE.value and rent_status is None:
            return "AVAILABLE"
        return "STALE"

    eng = (engine_status or "").upper()
    spd = float(speed or 0)
    load = float(load_percentage or 0)

    if eng == "ON":
        if spd >= 8.0:
            return "IN_TRANSIT"
        if load < 15.0 and spd < 1.0:
            return "IDLE"
        return "WORKING"

    if eng in {"OFF", ""}:
        return "OFF"

    return "WORKING"


def _enum_val(v: Any) -> Optional[str]:
    if v is None:
        return None
    return v.value if hasattr(v, "value") else str(v)
