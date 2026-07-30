"""Transparent, customer-first package ranking."""
from __future__ import annotations

import hashlib
import math
from dataclasses import asdict
from typing import Any, Literal

from app.services.demand_forecasting.forecasting import ForecastPoint
from app.services.demand_forecasting.synthetic import DemoDataset, PackageSpec, ProjectSpec, WeeklyDemand

Preference = Literal["BALANCED", "COST", "AVAILABILITY"]


def _current_package(project: ProjectSpec, equipment_type: str, packages: list[PackageSpec]) -> PackageSpec | None:
    preferred_suffix = {
        "OVER_RENTING": "_MONTHLY",
        "SHORTAGE_RISK": "_FLEX",
        "STABLE": "_BUFFER",
        "TEMPORARY_SPIKE": "_FLEX",
    }.get(project.scenario or "", "_FLEX")
    return next((package for package in packages if package.package_code.endswith(preferred_suffix)), None)


def _weights(preference: Preference) -> dict[str, float]:
    if preference == "COST":
        return {"shortage": 8500, "unused": 22, "commitment": 2800, "flex": 500}
    if preference == "AVAILABILITY":
        return {"shortage": 18000, "unused": 12, "commitment": 2500, "flex": 700}
    return {"shortage": 12500, "unused": 18, "commitment": 3200, "flex": 650}


def _candidate(
    package: PackageSpec,
    project: ProjectSpec,
    forecasts: list[ForecastPoint],
    preference: Preference,
) -> dict[str, Any]:
    total_hours = sum(point.predicted_machine_hours for point in forecasts)
    peak_expected = max((point.predicted_units for point in forecasts), default=0)
    peak_upper = max((point.upper_units for point in forecasts), default=0)
    horizon_days = len(forecasts) * 7
    periods = max(1, math.ceil(horizon_days / package.duration_days))
    included_hours = package.included_hours * periods
    extra_hours = max(0.0, total_hours - included_hours)
    cost = package.base_charge * periods + extra_hours * package.extra_hour_charge
    unused = max(0.0, included_hours - total_hours)
    flexible_buffer = 1 if package.billing_model in {"PAY_PER_USE", "WEEKLY", "HYBRID"} else 0
    effective_units = package.included_units + flexible_buffer
    if effective_units >= peak_upper:
        shortage_risk = 0.05
    elif effective_units >= peak_expected:
        shortage_risk = 0.24
    elif peak_upper > 0:
        shortage_risk = min(0.95, 0.35 + (peak_upper - effective_units) / peak_upper)
    else:
        shortage_risk = 0.02
    days_remaining = max(0, (project.expected_project_end - forecasts[0].forecast_week).days)
    commitment_risk = max(0.0, (package.minimum_commitment - days_remaining) / max(package.minimum_commitment, 1))
    weights = _weights(preference)
    score = (
        cost
        + shortage_risk * weights["shortage"]
        + unused * weights["unused"]
        + commitment_risk * weights["commitment"]
        - package.flexibility_score * weights["flex"]
    )
    return {
        "packageCode": package.package_code,
        "packageName": package.package_name,
        "billingModel": package.billing_model,
        "durationDays": package.duration_days,
        "includedUnits": package.included_units,
        "includedHours": package.included_hours,
        "estimatedCost": round(cost, 2),
        "expectedIncludedCapacityUsage": round(
            min(1.0, total_hours / included_hours) if included_hours else 0.0, 4
        ),
        "estimatedUnusedCapacity": round(unused, 2),
        "expectedExtraHourCharges": round(extra_hours * package.extra_hour_charge, 2),
        "shortageRisk": round(shortage_risk, 4),
        "commitmentRisk": round(commitment_risk, 4),
        "flexibilityScore": package.flexibility_score,
        "score": round(score, 2),
        "cancellationPolicy": package.cancellation_policy,
        "description": package.description,
        "simulatedPricing": True,
    }


def recommend_packages(
    dataset: DemoDataset,
    project: ProjectSpec,
    equipment_type: str,
    forecasts: list[ForecastPoint],
    history: list[WeeklyDemand],
    preference: Preference = "BALANCED",
) -> dict[str, Any]:
    applicable = [
        package for package in dataset.packages if package.equipment_type == equipment_type
    ]
    candidates = [_candidate(package, project, forecasts, preference) for package in applicable]
    candidates.sort(key=lambda item: item["score"])
    if not candidates:
        return {
            "action": "MANUAL_REVIEW",
            "explanation": "No simulated package supports this equipment type.",
            "recommended": None,
            "alternatives": [],
        }

    current = _current_package(project, equipment_type, applicable)
    current_candidate = next(
        (item for item in candidates if current and item["packageCode"] == current.package_code),
        None,
    )
    best = candidates[0]
    recent = history[-4:]
    engine = sum(row.engine_hours for row in recent)
    idle = sum(row.idle_hours for row in recent)
    operating_utilization = engine / (engine + idle) if engine + idle else 0.0
    trend = forecasts[0].trend if forecasts else "STABLE"

    if project.scenario == "OVER_RENTING":
        flexible = next(
            (candidate for candidate in candidates if candidate["packageCode"].endswith("_FLEX")),
            None,
        )
        if flexible:
            best = flexible
        action = "REDUCE_CAPACITY"
    elif operating_utilization < 0.45:
        action = "REDUCE_CAPACITY" if best["includedUnits"] < (current_candidate or best)["includedUnits"] else "MOVE_TO_FLEXIBLE_PACKAGE"
    elif project.scenario == "SHORTAGE_RISK":
        action = "INCREASE_CAPACITY"
    elif project.scenario == "TEMPORARY_SPIKE":
        addon = next((item for item in candidates if item["packageCode"].endswith("_ADDON")), None)
        if addon:
            best = addon
        action = "SHORT_TERM_ADD_ON"
    elif trend == "RISING" and (forecasts[0].predicted_utilization or 0) >= 0.78:
        action = "INCREASE_CAPACITY"
    elif current_candidate and abs(best["score"] - current_candidate["score"]) <= max(500, best["score"] * 0.08):
        best = current_candidate
        action = "CONTINUE_CURRENT_PACKAGE"
    elif best["billingModel"] in {"PAY_PER_USE", "WEEKLY", "HYBRID"}:
        action = "MOVE_TO_FLEXIBLE_PACKAGE"
    else:
        action = "RESERVE_IN_ADVANCE"

    baseline_cost = current_candidate["estimatedCost"] if current_candidate else best["estimatedCost"]
    best["estimatedSavings"] = round(max(0.0, baseline_cost - best["estimatedCost"]), 2)
    observation = (
        f"Recent operating utilization was {operating_utilization:.0%}"
        if recent
        else "This project has no verified usage history"
    )
    uncertainty = forecasts[0].confidence.replace("_", " ").lower() if forecasts else "unknown confidence"
    alt = next((candidate for candidate in candidates if candidate["packageCode"] != best["packageCode"]), None)
    benefit = {
        "REDUCE_CAPACITY": "reduce unused rental capacity",
        "MOVE_TO_FLEXIBLE_PACKAGE": "limit commitment while demand remains uncertain",
        "SHORT_TERM_ADD_ON": "cover the temporary peak without a long contract",
        "INCREASE_CAPACITY": "reduce the risk of a work stoppage",
        "CONTINUE_CURRENT_PACKAGE": "avoid an unnecessary package change",
        "RESERVE_IN_ADVANCE": "protect availability before the phase begins",
    }.get(action, "protect the project plan")
    explanation = (
        f"{observation}. Week 1 is forecast at {forecasts[0].predicted_units:.1f} units "
        f"with a {forecasts[0].lower_units:.1f}–{forecasts[0].upper_units:.1f} range. "
        f"{best['packageName']} may {benefit}. Confidence is {uncertainty}; pricing is "
        f"simulated."
    )
    if alt:
        explanation += f" {alt['packageName']} is the lower-ranked alternative if you prefer different flexibility."

    digest = hashlib.sha256(
        f"{project.project_id}:{equipment_type}:{dataset.as_of}:{best['packageCode']}".encode("utf-8")
    ).hexdigest()
    return {
        "recommendationId": int(digest[:8], 16) % 2_000_000_000,
        "projectId": project.project_id,
        "equipmentType": equipment_type,
        "action": action,
        "preference": preference,
        "currentPackageCode": current.package_code if current else None,
        "recommended": best,
        "alternatives": [item for item in candidates if item["packageCode"] != best["packageCode"]][:3],
        "explanation": explanation,
        "customerBenefit": benefit,
        "pricingVersion": best.get("version", "SIM-2026.1"),
        "simulatedPricing": True,
    }
