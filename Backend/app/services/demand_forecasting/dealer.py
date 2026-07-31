"""Dealer regional aggregation and guarded pre-positioning proposals."""
from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import date
from typing import Any, Callable

from app.services.demand_forecasting.forecasting import ForecastPoint
from app.services.demand_forecasting.synthetic import DemoDataset


def _available_count(dataset: DemoDataset, region: str, equipment_type: str, week: date) -> int:
    count = 0
    for unit in dataset.inventory:
        if unit.current_region != region or unit.equipment_type != equipment_type:
            continue
        if unit.status == "RESERVED":
            continue
        if unit.available_from <= week:
            count += 1
    return count


def build_dealer_view(
    dataset: DemoDataset,
    forecasts_by_project: dict[int, dict[str, list[ForecastPoint]]],
    project_lookup: Callable[[int], Any],
) -> dict[str, Any]:
    aggregated: dict[tuple[str, str, date], dict[str, Any]] = defaultdict(
        lambda: {"expectedDemand": 0.0, "safeDemand": 0, "projectCount": 0, "confidences": []}
    )
    for project_id, equipment_map in forecasts_by_project.items():
        project = project_lookup(project_id)
        for equipment_type, points in equipment_map.items():
            for point in points:
                key = (project.region, equipment_type, point.forecast_week)
                record = aggregated[key]
                record["expectedDemand"] += point.predicted_units
                record["safeDemand"] += point.safe_planning_units
                record["projectCount"] += 1
                record["confidences"].append(point.confidence)

    forecast_weeks = sorted({key[2] for key in aggregated})
    regions = sorted({unit.current_region for unit in dataset.inventory})
    equipment_types = sorted({unit.equipment_type for unit in dataset.inventory})
    for week in forecast_weeks:
        for region in regions:
            for equipment_type in equipment_types:
                aggregated[(region, equipment_type, week)]

    rows: list[dict[str, Any]] = []
    for (region, equipment_type, week), record in sorted(aggregated.items()):
        available = _available_count(dataset, region, equipment_type, week)
        shortage = record["safeDemand"] - available
        confidence = (
            "LOW"
            if any(value in {"LOW", "LIMITED_HISTORY", "COLD_START_ESTIMATE"} for value in record["confidences"])
            else "MODERATE"
            if "MODERATE" in record["confidences"]
            else "HIGH" if record["confidences"] else "NO_DEMAND_SIGNAL"
        )
        rows.append(
            {
                "region": region,
                "equipmentType": equipment_type,
                "forecastWeek": week.isoformat(),
                "expectedDemand": round(record["expectedDemand"], 2),
                "safeDemand": record["safeDemand"],
                "expectedAvailable": available,
                "shortageOrSurplus": shortage,
                "shortageUnits": max(shortage, 0),
                "surplusUnits": max(-shortage, 0),
                "projectCount": record["projectCount"],
                "confidence": confidence,
                "severity": "CRITICAL" if shortage >= 3 else "WARNING" if shortage > 0 else "SURPLUS",
            }
        )

    actions: list[dict[str, Any]] = []
    by_type_week: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_type_week[(row["equipmentType"], row["forecastWeek"])].append(row)
    for (equipment_type, week), group in by_type_week.items():
        shortages = sorted(
            [row for row in group if row["shortageUnits"] > 0],
            key=lambda item: item["shortageUnits"],
            reverse=True,
        )
        sources = sorted(
            [row for row in group if row["surplusUnits"] > 1],
            key=lambda item: item["surplusUnits"],
            reverse=True,
        )
        remaining_surplus = {
            source["region"]: source["surplusUnits"]
            for source in sources
        }
        for destination in shortages:
            source = next(
                (
                    candidate
                    for candidate in sources
                    if remaining_surplus[candidate["region"]] > 1
                ),
                None,
            )
            if source is None:
                continue
            source_surplus = remaining_surplus[source["region"]]
            transferable = max(0, source_surplus - 1)
            units = min(destination["shortageUnits"], transferable)
            if units <= 0:
                continue
            digest = hashlib.sha256(
                f"{equipment_type}:{week}:{source['region']}:{destination['region']}".encode("utf-8")
            ).hexdigest()
            actions.append(
                {
                    "actionId": int(digest[:8], 16) % 2_000_000_000,
                    "equipmentType": equipment_type,
                    "forecastWeek": week,
                    "sourceRegion": source["region"],
                    "destinationRegion": destination["region"],
                    "recommendedUnits": units,
                    "sourceSafetyBuffer": 1,
                    "transferLeadDays": 3,
                    "status": "PROPOSED",
                    "customerImpact": (
                        f"Source retains {source_surplus - units} units above safe demand."
                    ),
                    "rationale": (
                        f"{destination['region']} has a safe-planning shortage of "
                        f"{destination['shortageUnits']} {equipment_type.lower()} units. "
                        f"{source['region']} has protected surplus after a one-unit buffer."
                    ),
                }
            )
            remaining_surplus[source["region"]] = source_surplus - units

    return {
        "rows": rows,
        "actions": actions,
        "inventoryAsOf": dataset.as_of.isoformat(),
        "synthetic": True,
        "warning": "Synthetic forecasts and inventory; transfer approval remains mandatory.",
    }
