"""Fleet Manager dashboard queries (company-scoped rentals + live telemetry)."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import Select, desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.domain import (
    AnomalyAlert,
    Equipment,
    EquipmentAssignment,
    EquipmentTelemetry,
    ProjectSite,
    RentalContract,
)
from app.models.enums import AnomalySeverity, AssignmentStatus, RentalContractStatus
from app.services.fleet.live_status import derive_live_status


def _f(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


class FleetService:
    @staticmethod
    def list_machines(
        db: Session,
        *,
        company_id: Optional[int] = None,
        site_id: Optional[int] = None,
        live_status: Optional[str] = None,
        equipment_type: Optional[str] = None,
        rental_status: Optional[str] = None,
        has_alert: Optional[bool] = None,
        unassigned_only: bool = False,
        q: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        contracts = FleetService._active_contracts_query(db, company_id=company_id)
        rows: list[dict[str, Any]] = []
        for contract in contracts:
            row = FleetService._machine_row(db, contract)
            if site_id is not None and row.get("siteId") != site_id:
                continue
            if equipment_type and (row.get("equipmentType") or "").lower() != equipment_type.lower():
                continue
            if rental_status and row.get("rentalStatus") != rental_status:
                continue
            if has_alert is True and row.get("openAlertCount", 0) == 0:
                continue
            if has_alert is False and row.get("openAlertCount", 0) > 0:
                continue
            # Unassigned: no site and/or no operator (misuse signal from PS)
            if unassigned_only and row.get("siteId") is not None and row.get("operatorId"):
                continue
            if live_status and row.get("liveStatus") != live_status:
                continue
            if q:
                blob = " ".join(
                    str(row.get(k) or "")
                    for k in ("equipmentName", "equipmentType", "siteName", "equipmentId")
                ).lower()
                if q.lower() not in blob:
                    continue
            rows.append(row)
            if len(rows) >= limit:
                break
        return rows

    @staticmethod
    def overview(db: Session, *, company_id: Optional[int] = None) -> dict[str, Any]:
        machines = FleetService.list_machines(db, company_id=company_id, limit=500)
        by_status: dict[str, int] = {}
        for m in machines:
            s = m["liveStatus"]
            by_status[s] = by_status.get(s, 0) + 1

        open_critical = sum(
            1
            for m in machines
            if m.get("highestSeverity") == "CRITICAL" and m.get("openAlertCount", 0) > 0
        )
        expiring = FleetService.contracts_expiring(db, company_id=company_id, days=7)
        return {
            "success": True,
            "totals": {
                "machinesRented": len(machines),
                "working": by_status.get("WORKING", 0),
                "idle": by_status.get("IDLE", 0),
                "off": by_status.get("OFF", 0),
                "overdue": by_status.get("OVERDUE", 0),
                "withOpenAlerts": sum(1 for m in machines if m.get("openAlertCount", 0) > 0),
                "staleTelemetry": by_status.get("STALE", 0),
                "inTransit": by_status.get("IN_TRANSIT", 0),
                "alert": by_status.get("ALERT", 0),
            },
            "statusBreakdown": by_status,
            "contractsExpiring7d": len(expiring),
            "criticalAlerts": open_critical,
            "generatedAt": datetime.utcnow().isoformat(),
        }

    @staticmethod
    def machine_detail(
        db: Session, equipment_id: int, *, company_id: Optional[int] = None
    ) -> Optional[dict[str, Any]]:
        machines = FleetService.list_machines(db, company_id=company_id, limit=500)
        for m in machines:
            if m["equipmentId"] == equipment_id:
                m = dict(m)
                m["telemetryHistory"] = FleetService.telemetry_history(
                    db, equipment_id, limit=50
                )
                m["alerts"] = FleetService.alerts_for_equipment(db, str(equipment_id), limit=20)
                return m
        return None

    @staticmethod
    def map_pins(
        db: Session, *, company_id: Optional[int] = None
    ) -> list[dict[str, Any]]:
        pins = []
        for m in FleetService.list_machines(db, company_id=company_id, limit=500):
            tel = m.get("telemetry") or {}
            if tel.get("latitude") is None or tel.get("longitude") is None:
                continue
            pins.append(
                {
                    "equipmentId": m["equipmentId"],
                    "equipmentName": m.get("equipmentName"),
                    "equipmentType": m.get("equipmentType"),
                    "liveStatus": m["liveStatus"],
                    "latitude": tel["latitude"],
                    "longitude": tel["longitude"],
                    "siteName": m.get("siteName"),
                    "lastSeenAt": m.get("lastSeenAt"),
                }
            )
        return pins

    @staticmethod
    def fleet_sites(db: Session, *, company_id: Optional[int] = None) -> list[dict[str, Any]]:
        machines = FleetService.list_machines(db, company_id=company_id, limit=500)
        by_site: dict[Any, dict[str, Any]] = {}
        for m in machines:
            sid = m.get("siteId") or "unassigned"
            if sid not in by_site:
                by_site[sid] = {
                    "siteId": m.get("siteId"),
                    "siteName": m.get("siteName") or "Unassigned",
                    "machineCount": 0,
                    "openAlerts": 0,
                    "working": 0,
                    "idle": 0,
                }
            bucket = by_site[sid]
            bucket["machineCount"] += 1
            bucket["openAlerts"] += int(m.get("openAlertCount") or 0)
            if m["liveStatus"] == "WORKING":
                bucket["working"] += 1
            if m["liveStatus"] == "IDLE":
                bucket["idle"] += 1
        return list(by_site.values())

    @staticmethod
    def unassigned(db: Session, *, company_id: Optional[int] = None) -> list[dict[str, Any]]:
        return [
            m
            for m in FleetService.list_machines(db, company_id=company_id, limit=500)
            if m.get("siteId") is None or not m.get("operatorId")
        ]

    @staticmethod
    def live_logs(
        db: Session,
        *,
        company_id: Optional[int] = None,
        equipment_id: Optional[int] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Synthetic event feed from recent alerts + telemetry timestamps."""
        events: list[dict[str, Any]] = []

        alert_stmt = select(AnomalyAlert).order_by(desc(AnomalyAlert.detected_at)).limit(limit)
        for a in db.execute(alert_stmt).scalars().all():
            if equipment_id is not None and str(a.equipment_id) != str(equipment_id):
                continue
            events.append(
                {
                    "id": f"alert-{a.alert_id}",
                    "type": "ALERT_RAISED" if not a.is_resolved else "ALERT_RESOLVED",
                    "equipmentId": a.equipment_id,
                    "severity": a.severity.value if a.severity else None,
                    "message": a.description,
                    "ts": a.detected_at.isoformat() if a.detected_at else None,
                }
            )

        # Latest telemetry samples
        tel_stmt = (
            select(EquipmentTelemetry)
            .order_by(desc(EquipmentTelemetry.timestamp))
            .limit(limit)
        )
        for t in db.execute(tel_stmt).scalars().all():
            if equipment_id is not None and t.equipment_id != equipment_id:
                continue
            if company_id is not None:
                # only include if equipment under company rental
                if not FleetService._equipment_in_company(db, t.equipment_id, company_id):
                    continue
            events.append(
                {
                    "id": f"tel-{t.telemetry_id}",
                    "type": "TELEMETRY_RECEIVED",
                    "equipmentId": str(t.equipment_id),
                    "message": (
                        f"Telemetry eq={t.equipment_id} engine={t.engine_status} "
                        f"temp={t.engine_temperature} fuel={t.fuel_level}"
                    ),
                    "ts": t.timestamp.isoformat() if t.timestamp else None,
                }
            )

        events.sort(key=lambda e: e.get("ts") or "", reverse=True)
        return events[:limit]

    @staticmethod
    def telemetry_history(
        db: Session, equipment_id: int, *, limit: int = 100
    ) -> list[dict[str, Any]]:
        stmt = (
            select(EquipmentTelemetry)
            .where(EquipmentTelemetry.equipment_id == equipment_id)
            .order_by(desc(EquipmentTelemetry.timestamp))
            .limit(limit)
        )
        out = []
        for t in db.execute(stmt).scalars().all():
            out.append(
                {
                    "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                    "engineStatus": t.engine_status,
                    "fuelLevel": _f(t.fuel_level),
                    "engineHours": _f(t.engine_hours),
                    "idleHours": _f(t.idle_hours),
                    "speed": _f(t.speed),
                    "latitude": _f(t.latitude),
                    "longitude": _f(t.longitude),
                    "engineTemperature": _f(t.engine_temperature),
                    "batteryVoltage": _f(t.battery_voltage),
                    "loadPercentage": _f(t.load_percentage),
                    "vibrationLevel": _f(t.vibration_level),
                }
            )
        return out

    @staticmethod
    def alerts_for_equipment(
        db: Session, equipment_id: str, *, limit: int = 20
    ) -> list[dict[str, Any]]:
        stmt = (
            select(AnomalyAlert)
            .where(AnomalyAlert.equipment_id == str(equipment_id))
            .order_by(desc(AnomalyAlert.detected_at))
            .limit(limit)
        )
        return [FleetService._alert_dict(a) for a in db.execute(stmt).scalars().all()]

    @staticmethod
    def contracts_expiring(
        db: Session, *, company_id: Optional[int] = None, days: int = 7
    ) -> list[dict[str, Any]]:
        now = datetime.utcnow()
        until = now + timedelta(days=days)
        stmt = select(RentalContract).where(
            RentalContract.rental_status == RentalContractStatus.ACTIVE,
            RentalContract.expected_return.is_not(None),
            RentalContract.expected_return <= until,
            RentalContract.expected_return >= now,
        )
        if company_id is not None:
            stmt = stmt.where(RentalContract.company_id == company_id)
        stmt = stmt.options(joinedload(RentalContract.equipment))
        out = []
        for c in db.execute(stmt).unique().scalars().all():
            out.append(
                {
                    "contractId": c.contract_id,
                    "equipmentId": c.equipment_id,
                    "equipmentName": c.equipment.equipment_name if c.equipment else None,
                    "expectedReturn": c.expected_return.isoformat() if c.expected_return else None,
                    "rentalStatus": c.rental_status.value if c.rental_status else None,
                }
            )
        return out

    @staticmethod
    def contracts_overdue(
        db: Session, *, company_id: Optional[int] = None
    ) -> list[dict[str, Any]]:
        stmt = select(RentalContract).where(
            RentalContract.rental_status == RentalContractStatus.OVERDUE
        )
        if company_id is not None:
            stmt = stmt.where(RentalContract.company_id == company_id)
        stmt = stmt.options(joinedload(RentalContract.equipment))
        out = []
        for c in db.execute(stmt).unique().scalars().all():
            out.append(
                {
                    "contractId": c.contract_id,
                    "equipmentId": c.equipment_id,
                    "equipmentName": c.equipment.equipment_name if c.equipment else None,
                    "expectedReturn": c.expected_return.isoformat() if c.expected_return else None,
                    "rentalStatus": c.rental_status.value if c.rental_status else None,
                }
            )
        return out

    # ── internals ──────────────────────────────────────────────────

    @staticmethod
    def _active_contracts_query(
        db: Session, *, company_id: Optional[int]
    ) -> list[RentalContract]:
        stmt: Select = (
            select(RentalContract)
            .where(
                RentalContract.rental_status.in_(
                    [RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE]
                )
            )
            .options(
                joinedload(RentalContract.equipment).joinedload(Equipment.dealer),
                joinedload(RentalContract.equipment_assignments)
                .joinedload(EquipmentAssignment.site),
            )
            .order_by(RentalContract.contract_id)
        )
        if company_id is not None:
            stmt = stmt.where(RentalContract.company_id == company_id)
        return list(db.execute(stmt).unique().scalars().all())

    @staticmethod
    def _machine_row(db: Session, contract: RentalContract) -> dict[str, Any]:
        eq = contract.equipment
        eq_id = contract.equipment_id
        tel = FleetService._latest_telemetry(db, eq_id)
        site, operator_id = FleetService._active_assignment(contract)
        open_alerts, highest = FleetService._open_alert_stats(db, str(eq_id))

        last_seen = tel.timestamp if tel else None
        live = derive_live_status(
            equipment_status=eq.status if eq else None,
            rental_status=contract.rental_status,
            engine_status=tel.engine_status if tel else None,
            speed=_f(tel.speed) if tel else None,
            load_percentage=_f(tel.load_percentage) if tel else None,
            last_seen_at=last_seen,
            open_alert_count=open_alerts,
            highest_severity=highest,
        )

        dealer_name = None
        if eq and eq.dealer:
            dealer_name = eq.dealer.dealer_name

        return {
            "equipmentId": eq_id,
            "equipmentName": eq.equipment_name if eq else None,
            "equipmentType": eq.equipment_type if eq else None,
            "dealerName": dealer_name,
            "contractId": contract.contract_id,
            "rentalStatus": contract.rental_status.value if contract.rental_status else None,
            "expectedReturn": (
                contract.expected_return.isoformat() if contract.expected_return else None
            ),
            "siteId": site.site_id if site else None,
            "siteName": site.site_name if site else None,
            "operatorId": operator_id,
            "liveStatus": live,
            "lastSeenAt": last_seen.isoformat() if last_seen else None,
            "openAlertCount": open_alerts,
            "highestSeverity": highest,
            "telemetry": {
                "engineStatus": tel.engine_status if tel else None,
                "fuelLevel": _f(tel.fuel_level) if tel else None,
                "engineHours": _f(tel.engine_hours) if tel else None,
                "idleHours": _f(tel.idle_hours) if tel else None,
                "speed": _f(tel.speed) if tel else None,
                "latitude": _f(tel.latitude) if tel else None,
                "longitude": _f(tel.longitude) if tel else None,
                "engineTemperature": _f(tel.engine_temperature) if tel else None,
                "batteryVoltage": _f(tel.battery_voltage) if tel else None,
                "loadPercentage": _f(tel.load_percentage) if tel else None,
                "vibrationLevel": _f(tel.vibration_level) if tel else None,
            }
            if tel
            else None,
        }

    @staticmethod
    def _latest_telemetry(db: Session, equipment_id: int) -> Optional[EquipmentTelemetry]:
        stmt = (
            select(EquipmentTelemetry)
            .where(EquipmentTelemetry.equipment_id == equipment_id)
            .order_by(desc(EquipmentTelemetry.timestamp))
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def _active_assignment(
        contract: RentalContract,
    ) -> tuple[Optional[ProjectSite], Optional[str]]:
        for a in contract.equipment_assignments or []:
            if a.status == AssignmentStatus.ACTIVE or a.status is None:
                return a.site, None
        # fallback: latest assignment
        if contract.equipment_assignments:
            a = contract.equipment_assignments[0]
            return a.site, None
        return None, None

    @staticmethod
    def _open_alert_stats(
        db: Session, equipment_id: str
    ) -> tuple[int, Optional[str]]:
        stmt = select(AnomalyAlert).where(
            AnomalyAlert.equipment_id == equipment_id,
            AnomalyAlert.is_resolved.is_(False),
        )
        alerts = list(db.execute(stmt).scalars().all())
        if not alerts:
            return 0, None
        rank = {
            AnomalySeverity.CRITICAL: 3,
            AnomalySeverity.WARNING: 2,
            AnomalySeverity.INFO: 1,
        }
        best = max(alerts, key=lambda a: rank.get(a.severity, 0))
        return len(alerts), best.severity.value if best.severity else None

    @staticmethod
    def _equipment_in_company(db: Session, equipment_id: int, company_id: int) -> bool:
        stmt = (
            select(func.count())
            .select_from(RentalContract)
            .where(
                RentalContract.equipment_id == equipment_id,
                RentalContract.company_id == company_id,
                RentalContract.rental_status.in_(
                    [RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE]
                ),
            )
        )
        return int(db.execute(stmt).scalar_one() or 0) > 0

    @staticmethod
    def _alert_dict(a: AnomalyAlert) -> dict[str, Any]:
        return {
            "alertId": a.alert_id,
            "equipmentId": a.equipment_id,
            "equipmentType": a.equipment_type,
            "siteId": a.site_id,
            "operatorId": a.operator_id,
            "anomalyType": a.anomaly_type.value if a.anomaly_type else None,
            "severity": a.severity.value if a.severity else None,
            "description": a.description,
            "recommendation": a.recommendation,
            "triggerValue": a.trigger_value,
            "thresholdValue": a.threshold_value,
            "isResolved": a.is_resolved,
            "resolvedAt": a.resolved_at.isoformat() if a.resolved_at else None,
            "detectedAt": a.detected_at.isoformat() if a.detected_at else None,
        }
