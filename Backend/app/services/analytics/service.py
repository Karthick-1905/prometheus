"""Fleet usage & utilization analytics for dashboard widgets.

Data sources (in order of preference per equipment):
  1. UsageLog rows (assignment-linked runtime/idle/fuel)
  2. EquipmentTelemetry latest snapshot (engineHours / idleHours as proxies)

Utilization formula (per machine, window):
  util = runtime / (runtime + idle)   when (runtime + idle) > 0
  else 0

Downtime proxy:
  max(0, calendar_hours_in_window - runtime - idle) when using usage logs;
  or fraction of OFF readings when only telemetry is available.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.domain import (
    Equipment,
    EquipmentAssignment,
    EquipmentTelemetry,
    ProjectSite,
    RentalContract,
    UsageLog,
)
from app.models.enums import RentalContractStatus


def _f(v: Any) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _round(v: float, n: int = 2) -> float:
    return round(float(v), n)


class AnalyticsService:
    DEFAULT_UNDERUTILIZED_THRESHOLD = 0.35  # 35% utilization

    @staticmethod
    def usage_summary(
        db: Session,
        *,
        company_id: Optional[int] = None,
        days: int = 7,
        now: Optional[datetime] = None,
    ) -> dict[str, Any]:
        rows = AnalyticsService._equipment_usage_rows(
            db, company_id=company_id, days=days, now=now
        )
        total_runtime = sum(r["runtimeHours"] for r in rows)
        total_idle = sum(r["idleHours"] for r in rows)
        total_fuel = sum(r["fuelConsumed"] for r in rows)
        total_downtime = sum(r["downtimeHours"] for r in rows)
        denom = total_runtime + total_idle
        util = (total_runtime / denom) if denom > 0 else 0.0
        idle_ratio = (total_idle / denom) if denom > 0 else 0.0
        return {
            "windowDays": days,
            "machineCount": len(rows),
            "totalRuntimeHours": _round(total_runtime),
            "totalIdleHours": _round(total_idle),
            "totalFuelConsumed": _round(total_fuel),
            "totalDowntimeHours": _round(total_downtime),
            "utilizationPct": _round(util * 100, 1),
            "avgIdleRatio": _round(idle_ratio, 3),
            "generatedAt": (now or datetime.utcnow()).isoformat(),
        }

    @staticmethod
    def usage_by_site(
        db: Session,
        *,
        company_id: Optional[int] = None,
        days: int = 7,
        now: Optional[datetime] = None,
    ) -> list[dict[str, Any]]:
        rows = AnalyticsService._equipment_usage_rows(
            db, company_id=company_id, days=days, now=now
        )
        buckets: dict[Any, dict[str, Any]] = {}
        for r in rows:
            key = r.get("siteId") if r.get("siteId") is not None else "unassigned"
            if key not in buckets:
                buckets[key] = {
                    "siteId": r.get("siteId"),
                    "siteName": r.get("siteName") or "Unassigned",
                    "machineCount": 0,
                    "runtimeHours": 0.0,
                    "idleHours": 0.0,
                    "fuelConsumed": 0.0,
                    "downtimeHours": 0.0,
                }
            b = buckets[key]
            b["machineCount"] += 1
            b["runtimeHours"] += r["runtimeHours"]
            b["idleHours"] += r["idleHours"]
            b["fuelConsumed"] += r["fuelConsumed"]
            b["downtimeHours"] += r["downtimeHours"]

        out = []
        for b in buckets.values():
            denom = b["runtimeHours"] + b["idleHours"]
            util = (b["runtimeHours"] / denom) if denom > 0 else 0.0
            out.append(
                {
                    "siteId": b["siteId"],
                    "siteName": b["siteName"],
                    "machineCount": b["machineCount"],
                    "runtimeHours": _round(b["runtimeHours"]),
                    "idleHours": _round(b["idleHours"]),
                    "fuelConsumed": _round(b["fuelConsumed"]),
                    "downtimeHours": _round(b["downtimeHours"]),
                    "utilizationPct": _round(util * 100, 1),
                }
            )
        out.sort(key=lambda x: x["runtimeHours"], reverse=True)
        return out

    @staticmethod
    def usage_by_equipment(
        db: Session,
        *,
        company_id: Optional[int] = None,
        days: int = 7,
        now: Optional[datetime] = None,
    ) -> list[dict[str, Any]]:
        rows = AnalyticsService._equipment_usage_rows(
            db, company_id=company_id, days=days, now=now
        )
        # already per equipment
        return [
            {
                "equipmentId": r["equipmentId"],
                "equipmentName": r["equipmentName"],
                "equipmentType": r["equipmentType"],
                "siteId": r.get("siteId"),
                "siteName": r.get("siteName"),
                "runtimeHours": _round(r["runtimeHours"]),
                "idleHours": _round(r["idleHours"]),
                "fuelConsumed": _round(r["fuelConsumed"]),
                "downtimeHours": _round(r["downtimeHours"]),
                "utilizationPct": _round(r["utilization"] * 100, 1),
                "idleRatio": _round(r["idleRatio"], 3),
                "source": r["source"],
            }
            for r in sorted(rows, key=lambda x: x["runtimeHours"], reverse=True)
        ]

    @staticmethod
    def usage_by_type(
        db: Session,
        *,
        company_id: Optional[int] = None,
        days: int = 7,
        now: Optional[datetime] = None,
    ) -> list[dict[str, Any]]:
        rows = AnalyticsService._equipment_usage_rows(
            db, company_id=company_id, days=days, now=now
        )
        buckets: dict[str, dict[str, Any]] = {}
        for r in rows:
            t = r.get("equipmentType") or "Unknown"
            if t not in buckets:
                buckets[t] = {
                    "equipmentType": t,
                    "machineCount": 0,
                    "runtimeHours": 0.0,
                    "idleHours": 0.0,
                    "fuelConsumed": 0.0,
                    "downtimeHours": 0.0,
                }
            b = buckets[t]
            b["machineCount"] += 1
            b["runtimeHours"] += r["runtimeHours"]
            b["idleHours"] += r["idleHours"]
            b["fuelConsumed"] += r["fuelConsumed"]
            b["downtimeHours"] += r["downtimeHours"]

        out = []
        for b in buckets.values():
            denom = b["runtimeHours"] + b["idleHours"]
            util = (b["runtimeHours"] / denom) if denom > 0 else 0.0
            out.append(
                {
                    "equipmentType": b["equipmentType"],
                    "machineCount": b["machineCount"],
                    "runtimeHours": _round(b["runtimeHours"]),
                    "idleHours": _round(b["idleHours"]),
                    "fuelConsumed": _round(b["fuelConsumed"]),
                    "downtimeHours": _round(b["downtimeHours"]),
                    "utilizationPct": _round(util * 100, 1),
                }
            )
        out.sort(key=lambda x: x["runtimeHours"], reverse=True)
        return out

    @staticmethod
    def utilization(
        db: Session,
        *,
        company_id: Optional[int] = None,
        days: int = 7,
        now: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """Fleet + per-machine utilization (HLD 7-day window default)."""
        rows = AnalyticsService._equipment_usage_rows(
            db, company_id=company_id, days=days, now=now
        )
        if not rows:
            return {
                "windowDays": days,
                "fleetUtilizationPct": 0.0,
                "avgIdleRatio": 0.0,
                "machineCount": 0,
                "machines": [],
                "generatedAt": (now or datetime.utcnow()).isoformat(),
            }

        total_rt = sum(r["runtimeHours"] for r in rows)
        total_idle = sum(r["idleHours"] for r in rows)
        denom = total_rt + total_idle
        fleet_util = (total_rt / denom) if denom > 0 else 0.0
        avg_idle = sum(r["idleRatio"] for r in rows) / len(rows)

        machines = [
            {
                "equipmentId": r["equipmentId"],
                "equipmentName": r["equipmentName"],
                "equipmentType": r["equipmentType"],
                "siteName": r.get("siteName"),
                "utilizationPct": _round(r["utilization"] * 100, 1),
                "idleRatio": _round(r["idleRatio"], 3),
                "runtimeHours": _round(r["runtimeHours"]),
                "idleHours": _round(r["idleHours"]),
            }
            for r in sorted(rows, key=lambda x: x["utilization"])
        ]
        return {
            "windowDays": days,
            "fleetUtilizationPct": _round(fleet_util * 100, 1),
            "avgIdleRatio": _round(avg_idle, 3),
            "machineCount": len(rows),
            "machines": machines,
            "generatedAt": (now or datetime.utcnow()).isoformat(),
        }

    @staticmethod
    def underutilized(
        db: Session,
        *,
        company_id: Optional[int] = None,
        days: int = 7,
        threshold: float = DEFAULT_UNDERUTILIZED_THRESHOLD,
        now: Optional[datetime] = None,
    ) -> list[dict[str, Any]]:
        """Machines below utilization threshold (PS: flag under-utilized assets)."""
        rows = AnalyticsService._equipment_usage_rows(
            db, company_id=company_id, days=days, now=now
        )
        thr = max(0.0, min(1.0, float(threshold)))
        flagged = []
        for r in rows:
            if r["utilization"] < thr:
                flagged.append(
                    {
                        "equipmentId": r["equipmentId"],
                        "equipmentName": r["equipmentName"],
                        "equipmentType": r["equipmentType"],
                        "siteId": r.get("siteId"),
                        "siteName": r.get("siteName"),
                        "utilizationPct": _round(r["utilization"] * 100, 1),
                        "idleRatio": _round(r["idleRatio"], 3),
                        "runtimeHours": _round(r["runtimeHours"]),
                        "idleHours": _round(r["idleHours"]),
                        "thresholdPct": _round(thr * 100, 1),
                        "reason": (
                            f"Utilization {_round(r['utilization'] * 100, 1)}% "
                            f"is below {_round(thr * 100, 1)}% threshold over {days}d"
                        ),
                    }
                )
        flagged.sort(key=lambda x: x["utilizationPct"])
        return flagged

    # ── internals ──────────────────────────────────────────────────

    @staticmethod
    def _equipment_usage_rows(
        db: Session,
        *,
        company_id: Optional[int],
        days: int,
        now: Optional[datetime],
    ) -> list[dict[str, Any]]:
        now = now or datetime.utcnow()
        window_start = now - timedelta(days=max(1, days))
        calendar_hours = float(max(1, days) * 24)

        contracts = AnalyticsService._fleet_contracts(db, company_id=company_id)
        if not contracts:
            return []

        # Preload usage logs in window for company assignments
        usage_by_eq = AnalyticsService._usage_log_aggregates(
            db, company_id=company_id, window_start=window_start
        )
        # Latest + window telemetry
        tel_by_eq = AnalyticsService._telemetry_aggregates(
            db,
            equipment_ids=[c.equipment_id for c in contracts],
            window_start=window_start,
        )

        rows: list[dict[str, Any]] = []
        for contract in contracts:
            eq = contract.equipment
            if not eq:
                continue
            eq_id = eq.equipment_id
            site = AnalyticsService._active_site(contract)

            if eq_id in usage_by_eq:
                u = usage_by_eq[eq_id]
                runtime = u["runtime"]
                idle = u["idle"]
                fuel = u["fuel"]
                source = "usage_log"
                downtime = max(0.0, calendar_hours - runtime - idle)
            elif eq_id in tel_by_eq:
                t = tel_by_eq[eq_id]
                # Cumulative hour meters are not deltas — use load% / engine status as window proxy
                # Prefer explicit window deltas when multiple readings exist
                runtime = t["runtime"]
                idle = t["idle"]
                fuel = t["fuel"]
                downtime = t["downtime"]
                source = "telemetry"
            else:
                runtime = idle = fuel = 0.0
                downtime = calendar_hours
                source = "none"

            denom = runtime + idle
            util = (runtime / denom) if denom > 0 else 0.0
            idle_ratio = (idle / denom) if denom > 0 else 0.0

            rows.append(
                {
                    "equipmentId": eq_id,
                    "equipmentName": eq.equipment_name,
                    "equipmentType": eq.equipment_type,
                    "contractId": contract.contract_id,
                    "siteId": site.site_id if site else None,
                    "siteName": site.site_name if site else None,
                    "runtimeHours": runtime,
                    "idleHours": idle,
                    "fuelConsumed": fuel,
                    "downtimeHours": downtime,
                    "utilization": util,
                    "idleRatio": idle_ratio,
                    "source": source,
                }
            )
        return rows

    @staticmethod
    def _fleet_contracts(
        db: Session, *, company_id: Optional[int]
    ) -> list[RentalContract]:
        stmt = (
            select(RentalContract)
            .where(
                RentalContract.rental_status.in_(
                    [RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE]
                )
            )
            .options(
                joinedload(RentalContract.equipment),
                joinedload(RentalContract.equipment_assignments).joinedload(
                    EquipmentAssignment.site
                ),
            )
            .order_by(RentalContract.contract_id)
        )
        if company_id is not None:
            stmt = stmt.where(RentalContract.company_id == company_id)
        return list(db.execute(stmt).unique().scalars().all())

    @staticmethod
    def _active_site(contract: RentalContract) -> Optional[ProjectSite]:
        for a in contract.equipment_assignments or []:
            if a.status is None or (hasattr(a.status, "value") and a.status.value == "ACTIVE"):
                return a.site
            if str(a.status) == "ACTIVE":
                return a.site
        # any assignment
        if contract.equipment_assignments:
            return contract.equipment_assignments[0].site
        return None

    @staticmethod
    def _usage_log_aggregates(
        db: Session,
        *,
        company_id: Optional[int],
        window_start: datetime,
    ) -> dict[int, dict[str, float]]:
        stmt = (
            select(UsageLog)
            .options(
                joinedload(UsageLog.assignment)
                .joinedload(EquipmentAssignment.contract)
                .joinedload(RentalContract.equipment),
                joinedload(UsageLog.assignment).joinedload(EquipmentAssignment.site),
            )
            .where(UsageLog.recorded_at.is_not(None), UsageLog.recorded_at >= window_start)
        )
        logs = db.execute(stmt).unique().scalars().all()
        agg: dict[int, dict[str, float]] = defaultdict(
            lambda: {"runtime": 0.0, "idle": 0.0, "fuel": 0.0}
        )
        for log in logs:
            assignment = log.assignment
            if not assignment or not assignment.contract:
                continue
            if company_id is not None and assignment.contract.company_id != company_id:
                continue
            eq_id = assignment.contract.equipment_id
            agg[eq_id]["runtime"] += _f(log.runtime_hours)
            agg[eq_id]["idle"] += _f(log.idle_hours)
            agg[eq_id]["fuel"] += _f(log.fuel_consumed)
        return dict(agg)

    @staticmethod
    def _telemetry_aggregates(
        db: Session,
        *,
        equipment_ids: list[int],
        window_start: datetime,
    ) -> dict[int, dict[str, float]]:
        if not equipment_ids:
            return {}
        stmt = (
            select(EquipmentTelemetry)
            .where(
                EquipmentTelemetry.equipment_id.in_(equipment_ids),
                EquipmentTelemetry.timestamp >= window_start,
            )
            .order_by(EquipmentTelemetry.equipment_id, EquipmentTelemetry.timestamp)
        )
        rows = list(db.execute(stmt).scalars().all())
        by_eq: dict[int, list[EquipmentTelemetry]] = defaultdict(list)
        for r in rows:
            by_eq[r.equipment_id].append(r)

        out: dict[int, dict[str, float]] = {}
        for eq_id, series in by_eq.items():
            if len(series) >= 2:
                first, last = series[0], series[-1]
                # hour meters are cumulative → deltas over window
                runtime = max(0.0, _f(last.engine_hours) - _f(first.engine_hours))
                idle = max(0.0, _f(last.idle_hours) - _f(first.idle_hours))
                fuel = max(0.0, _f(first.fuel_level) - _f(last.fuel_level))
            else:
                # single reading: use load% as runtime proxy for 1 "unit day"
                t = series[0]
                load = _f(t.load_percentage) / 100.0
                eng_on = (t.engine_status or "").upper() == "ON"
                if eng_on:
                    runtime = max(0.5, 8.0 * load)  # nominal shift * load
                    idle = max(0.0, 8.0 - runtime)
                else:
                    runtime = 0.0
                    idle = 0.0
                fuel = 0.0

            off_count = sum(
                1 for t in series if (t.engine_status or "").upper() in {"OFF", ""}
            )
            downtime = (off_count / max(1, len(series))) * 24.0  # rough daily OFF share

            out[eq_id] = {
                "runtime": runtime,
                "idle": idle,
                "fuel": fuel,
                "downtime": downtime,
            }

        # Also include latest-only machines with no in-window rows via separate fetch
        missing = [i for i in equipment_ids if i not in out]
        if missing:
            for eq_id in missing:
                latest = db.execute(
                    select(EquipmentTelemetry)
                    .where(EquipmentTelemetry.equipment_id == eq_id)
                    .order_by(EquipmentTelemetry.timestamp.desc())
                    .limit(1)
                ).scalar_one_or_none()
                if not latest:
                    continue
                load = _f(latest.load_percentage) / 100.0
                eng_on = (latest.engine_status or "").upper() == "ON"
                if eng_on:
                    runtime = max(0.5, 8.0 * load)
                    idle = max(0.0, 8.0 - runtime)
                    downtime = 0.0
                else:
                    runtime = 0.0
                    idle = 0.0
                    downtime = 8.0
                out[eq_id] = {
                    "runtime": runtime,
                    "idle": idle,
                    "fuel": 0.0,
                    "downtime": downtime,
                }
        return out
