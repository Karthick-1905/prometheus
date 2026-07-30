"""Leakage-safe feature construction for weekly project/equipment demand."""
from __future__ import annotations

import math
from collections import defaultdict
from statistics import mean, pstdev
from typing import Any, Iterable

from app.services.demand_forecasting.synthetic import (
    EXPECTED_HOURS_PER_UNIT_WEEK,
    WeeklyDemand,
)

FEATURE_SCHEMA_VERSION = "2.0"
CATEGORICAL_FEATURES = [
    "project_type",
    "region",
    "project_phase",
    "equipment_type",
]
NUMERIC_FEATURES = [
    "project_size",
    "forecast_horizon",
    "month",
    "week_of_year_sin",
    "week_of_year_cos",
    "lag_1",
    "lag_2",
    "lag_4",
    "rolling_mean_4",
    "weighted_mean_4",
    "rolling_mean_8",
    "rolling_max_4",
    "rolling_std_4",
    "recent_growth",
    "zero_weeks_4",
    "engine_hours_lag_1",
    "rolling_engine_hours_4",
    "weighted_engine_hours_4",
    "rolling_idle_hours_4",
    "operating_utilization",
    "capacity_utilization",
]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES


def _lag(values: list[float], offset: int) -> float:
    return float(values[-offset]) if len(values) >= offset else 0.0


def _weighted_average(values: list[float]) -> float:
    if not values:
        return 0.0
    tail = values[-4:]
    weights = [1, 2, 3, 4][-len(tail):]
    return sum(value * weight for value, weight in zip(tail, weights)) / sum(weights)


def feature_from_history(
    *,
    project_type: str,
    project_size: float,
    region: str,
    project_phase: str,
    equipment_type: str,
    target_week,
    history: list[WeeklyDemand],
    forecast_horizon: int = 1,
) -> dict[str, Any]:
    requested = [float(row.requested_units) for row in history]
    engine = [float(row.engine_hours) for row in history]
    idle = [float(row.idle_hours) for row in history]
    rented = [float(row.rented_units) for row in history]
    rented_days = [float(row.rented_days) for row in history]
    last4 = requested[-4:]
    last8 = requested[-8:]
    eng4 = engine[-4:]
    idle4 = idle[-4:]
    week_number = int(target_week.isocalendar().week)

    engine_total = sum(eng4)
    idle_total = sum(idle4)
    operating_util = engine_total / (engine_total + idle_total) if engine_total + idle_total else 0.0
    unit_days = sum(u * d for u, d in zip(rented[-4:], rented_days[-4:]))
    expected_daily = EXPECTED_HOURS_PER_UNIT_WEEK.get(equipment_type, 42.0) / 6.0
    capacity = unit_days * expected_daily
    capacity_util = engine_total / capacity if capacity else 0.0
    older = mean(last4[:-1]) if len(last4) > 1 else (_lag(requested, 1) or 1.0)
    recent_growth = (_lag(requested, 1) - older) / max(older, 1.0)

    return {
        "project_type": project_type or "UNKNOWN",
        "project_size": float(project_size),
        "forecast_horizon": int(forecast_horizon),
        "region": region or "UNKNOWN",
        "project_phase": project_phase or "UNKNOWN",
        "equipment_type": equipment_type or "UNKNOWN",
        "month": target_week.month,
        "week_of_year_sin": math.sin((week_number / 52.0) * math.tau),
        "week_of_year_cos": math.cos((week_number / 52.0) * math.tau),
        "lag_1": _lag(requested, 1),
        "lag_2": _lag(requested, 2),
        "lag_4": _lag(requested, 4),
        "rolling_mean_4": mean(last4) if last4 else 0.0,
        "weighted_mean_4": _weighted_average(last4),
        "rolling_mean_8": mean(last8) if last8 else 0.0,
        "rolling_max_4": max(last4) if last4 else 0.0,
        "rolling_std_4": pstdev(last4) if len(last4) > 1 else 0.0,
        "recent_growth": recent_growth,
        "zero_weeks_4": sum(1 for value in last4 if value == 0),
        "engine_hours_lag_1": _lag(engine, 1),
        "rolling_engine_hours_4": mean(eng4) if eng4 else 0.0,
        "weighted_engine_hours_4": _weighted_average(eng4),
        "rolling_idle_hours_4": mean(idle4) if idle4 else 0.0,
        "operating_utilization": min(max(operating_util, 0.0), 1.0),
        "capacity_utilization": min(max(capacity_util, 0.0), 1.5),
    }


def build_supervised_rows(
    weekly_rows: Iterable[WeeklyDemand],
) -> tuple[list[dict[str, Any]], list[float], list[float], list]:
    grouped: dict[tuple[int, str], list[WeeklyDemand]] = defaultdict(list)
    for row in weekly_rows:
        grouped[(row.project_id, row.equipment_type)].append(row)

    features: list[dict[str, Any]] = []
    unit_targets: list[float] = []
    hour_targets: list[float] = []
    target_weeks: list = []
    for rows in grouped.values():
        rows.sort(key=lambda item: item.week_start)
        for origin_index in range(len(rows) - 1):
            history = rows[: origin_index + 1]
            for horizon in range(1, 5):
                target_index = origin_index + horizon
                if target_index >= len(rows):
                    break
                target = rows[target_index]
                features.append(
                    feature_from_history(
                        project_type=target.project_type,
                        project_size=target.project_size,
                        region=target.region,
                        project_phase=target.project_phase,
                        equipment_type=target.equipment_type,
                        target_week=target.week_start,
                        history=history,
                        forecast_horizon=horizon,
                    )
                )
                unit_targets.append(float(target.requested_units))
                hour_targets.append(float(target.engine_hours))
                target_weeks.append(target.week_start)
    return features, unit_targets, hour_targets, target_weeks
