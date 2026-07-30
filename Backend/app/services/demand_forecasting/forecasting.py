"""Four-week forecasting, uncertainty, cold starts, and explanations."""
from __future__ import annotations

import math
import hashlib
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from statistics import mean, pstdev
from typing import Any

import pandas as pd

from app.services.demand_forecasting.features import ALL_FEATURES, feature_from_history
from app.services.demand_forecasting.modeling import (
    DemandModelBundle,
    predict_serving_method,
)
from app.services.demand_forecasting.synthetic import (
    EXPECTED_HOURS_PER_UNIT_WEEK,
    PHASES,
    DemoDataset,
    ProjectSpec,
    WeeklyDemand,
)


@dataclass(frozen=True)
class ForecastPoint:
    forecast_id: int
    forecast_week: date
    predicted_units: float
    lower_units: float
    upper_units: float
    safe_planning_units: int
    predicted_machine_hours: float
    predicted_utilization: float | None
    trend: str
    confidence: str
    forecast_method: str
    cold_start: bool
    explanation: str
    comparable_cohort: str | None
    version: int = 1


def _next_phase(current_phase: str) -> str:
    try:
        index = PHASES.index(current_phase)
    except ValueError:
        return current_phase
    return PHASES[min(index + 1, len(PHASES) - 1)]


def phase_for_target(project: ProjectSpec, target_week: date) -> str:
    return _next_phase(project.current_phase) if target_week > project.phase_end_date else project.current_phase


def project_history(
    dataset: DemoDataset,
    project_id: int,
    equipment_type: str,
) -> list[WeeklyDemand]:
    return sorted(
        [
            row
            for row in dataset.weekly_demand
            if row.project_id == project_id and row.equipment_type == equipment_type
        ],
        key=lambda row: row.week_start,
    )


def _cohort_forecast(
    dataset: DemoDataset,
    project: ProjectSpec,
    equipment_type: str,
    phase: str,
) -> tuple[float, float, str, int]:
    levels = [
        (
            "same project type, size band, phase, equipment, and region",
            lambda row: row.project_type == project.project_type
            and abs(row.project_size - project.project_size) <= max(40, project.project_size * 0.35)
            and row.project_phase == phase
            and row.equipment_type == equipment_type
            and row.region == project.region,
        ),
        (
            "same project type, phase, and equipment",
            lambda row: row.project_type == project.project_type
            and row.project_phase == phase
            and row.equipment_type == equipment_type,
        ),
        (
            "same phase and equipment",
            lambda row: row.project_phase == phase and row.equipment_type == equipment_type,
        ),
        (
            "same project type and equipment",
            lambda row: row.project_type == project.project_type
            and row.equipment_type == equipment_type,
        ),
        (
            "overall equipment-type history",
            lambda row: row.equipment_type == equipment_type,
        ),
    ]
    for label, predicate in levels:
        matches = [row for row in dataset.weekly_demand if predicate(row)]
        if len(matches) >= 8:
            return (
                mean(row.requested_units for row in matches),
                mean(row.engine_hours for row in matches),
                label,
                len(matches),
            )
    return 0.0, 0.0, "no comparable project history", 0


def _weighted_average(values: list[float]) -> float:
    if not values:
        return 0.0
    tail = values[-4:]
    weights = [1, 2, 3, 4][-len(tail):]
    return sum(value * weight for value, weight in zip(tail, weights)) / sum(weights)


def forecast_project_equipment(
    dataset: DemoDataset,
    project: ProjectSpec,
    equipment_type: str,
    bundle: DemandModelBundle | None,
    horizon_weeks: int = 4,
) -> list[ForecastPoint]:
    history = project_history(dataset, project.project_id, equipment_type)
    cold_start = len(history) < 4
    results: list[ForecastPoint] = []
    first_week = dataset.as_of + timedelta(weeks=1)

    for horizon in range(horizon_weeks):
        target_week = first_week + timedelta(weeks=horizon)
        phase = phase_for_target(project, target_week)
        cohort_label: str | None = None
        cohort_count = 0
        if cold_start:
            predicted_units, predicted_hours, cohort_label, cohort_count = _cohort_forecast(
                dataset, project, equipment_type, phase
            )
            method = f"COHORT_FALLBACK_{cohort_count}"
            residual_width = max(1.0, predicted_units * (0.55 if cohort_count else 1.0))
            lower = max(0.0, predicted_units - residual_width)
            upper = predicted_units + residual_width
        else:
            feature = feature_from_history(
                project_type=project.project_type,
                project_size=project.project_size,
                region=project.region,
                project_phase=phase,
                equipment_type=equipment_type,
                target_week=target_week,
                history=history,
                forecast_horizon=horizon + 1,
            )
            if bundle:
                frame = pd.DataFrame([feature], columns=ALL_FEATURES)
                predicted_units = float(
                    predict_serving_method(
                        bundle.unit_serving_method,
                        frame,
                        target="units",
                        model=bundle.unit_model,
                        phase_equipment_means=bundle.unit_phase_equipment_means,
                    )[0]
                )
                predicted_hours = float(
                    predict_serving_method(
                        bundle.hour_serving_method,
                        frame,
                        target="hours",
                        model=bundle.hour_model,
                        phase_equipment_means=bundle.hour_phase_equipment_means,
                    )[0]
                )
                lower = max(0.0, predicted_units + bundle.unit_residual_low)
                upper = max(predicted_units, predicted_units + bundle.unit_residual_high)
                method = (
                    f"UNITS:{bundle.unit_serving_method};"
                    f"HOURS:{bundle.hour_serving_method};DIRECT_H{horizon + 1}"
                )
            else:
                unit_values = [float(row.requested_units) for row in history]
                hour_values = [float(row.engine_hours) for row in history]
                predicted_units = _weighted_average(unit_values)
                predicted_hours = _weighted_average(hour_values)
                dispersion = pstdev(unit_values[-8:]) if len(unit_values) > 1 else 0.75
                lower = max(0.0, predicted_units - max(0.75, dispersion))
                upper = predicted_units + max(0.75, dispersion)
                method = f"UNITS:WEIGHTED_MOVING_AVERAGE;HOURS:WEIGHTED_MOVING_AVERAGE;DIRECT_H{horizon + 1}"

        predicted_units = round(max(0.0, predicted_units), 2)
        predicted_hours = round(max(0.0, predicted_hours), 2)
        lower = round(max(0.0, min(lower, predicted_units)), 2)
        upper = round(max(predicted_units, upper), 2)
        safe = int(math.ceil(upper))
        utilization = (
            min(1.0, predicted_hours / (max(predicted_units, 1.0) * EXPECTED_HOURS_PER_UNIT_WEEK.get(equipment_type, 42.0)))
            if predicted_units > 0
            else None
        )
        last_units = float(history[-1].requested_units) if history else predicted_units
        if predicted_units > last_units + 0.35:
            trend = "RISING"
        elif predicted_units < last_units - 0.35:
            trend = "FALLING"
        else:
            trend = "STABLE"
        relative_width = (upper - lower) / max(predicted_units, 1.0)
        if cold_start:
            confidence = "COLD_START_ESTIMATE" if cohort_count else "LIMITED_HISTORY"
        elif relative_width <= 0.6 and len(history) >= 8:
            confidence = "HIGH"
        elif relative_width <= 1.1:
            confidence = "MODERATE"
        else:
            confidence = "LOW"

        observation = (
            f"Recent demand averaged {_weighted_average([float(row.requested_units) for row in history]):.1f} units"
            if history
            else f"No project-specific {equipment_type.lower()} history is available"
        )
        basis = (
            f" It uses {cohort_label} ({cohort_count} project-weeks)."
            if cold_start and cohort_label
            else ""
        )
        explanation = (
            f"{observation}. Week {horizon + 1} is expected to need {predicted_units:.1f} "
            f"{equipment_type.lower()} units ({lower:.1f}–{upper:.1f}) and about "
            f"{predicted_hours:.0f} machine-hours during {phase.lower()}.{basis}"
        )
        equipment_code = int(hashlib.sha256(equipment_type.encode("utf-8")).hexdigest()[:6], 16) % 500
        forecast_id = project.project_id * 10000 + equipment_code * 10 + horizon + 1
        results.append(
            ForecastPoint(
                forecast_id=forecast_id,
                forecast_week=target_week,
                predicted_units=predicted_units,
                lower_units=lower,
                upper_units=upper,
                safe_planning_units=safe,
                predicted_machine_hours=predicted_hours,
                predicted_utilization=round(utilization, 4) if utilization is not None else None,
                trend=trend,
                confidence=confidence,
                forecast_method=method,
                cold_start=cold_start,
                explanation=explanation,
                comparable_cohort=cohort_label,
            )
        )
    return results


def forecast_point_dict(point: ForecastPoint) -> dict[str, Any]:
    raw = asdict(point)
    return {
        "forecastId": raw["forecast_id"],
        "forecastWeek": raw["forecast_week"].isoformat(),
        "predictedUnits": raw["predicted_units"],
        "lowerUnits": raw["lower_units"],
        "upperUnits": raw["upper_units"],
        "safePlanningUnits": raw["safe_planning_units"],
        "predictedMachineHours": raw["predicted_machine_hours"],
        "predictedUtilization": raw["predicted_utilization"],
        "trend": raw["trend"],
        "confidence": raw["confidence"],
        "forecastMethod": raw["forecast_method"],
        "coldStart": raw["cold_start"],
        "explanation": raw["explanation"],
        "comparableCohort": raw["comparable_cohort"],
        "version": raw["version"],
    }
