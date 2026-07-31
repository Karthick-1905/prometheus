"""Authenticated, tenant-scoped compatibility telemetry snapshot."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
    require_fleet_access,
)
from app.services.fleet import FleetService

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])


def _principal(
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
) -> DashboardPrincipal:
    require_fleet_access(principal)
    return principal


@router.get("")
def fleet_snapshot(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(_principal),
):
    """Return the latest real telemetry sample for each visible rented machine."""
    machines = FleetService.list_machines(
        db, company_id=principal.company_id, limit=500
    )
    snapshot = []
    for machine in machines:
        telemetry = machine.get("telemetry")
        if telemetry is None:
            continue
        snapshot.append(
            {
                "equipmentId": machine["equipmentId"],
                "equipmentType": machine.get("equipmentType"),
                "status": machine.get("liveStatus"),
                "siteName": machine.get("siteName") or "Unassigned",
                "runtimeHours": telemetry.get("engineHours"),
                "idleHours": telemetry.get("idleHours"),
                # Fuel percentage comes only from EquipmentTelemetry.fuel_level.
                "fuelLevel": telemetry.get("fuelLevel"),
                "latitude": telemetry.get("latitude"),
                "longitude": telemetry.get("longitude"),
                "recordedAt": machine.get("lastSeenAt"),
            }
        )
    return {"success": True, "snapshot": snapshot}
