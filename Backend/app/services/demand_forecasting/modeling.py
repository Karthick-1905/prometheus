"""Training, time-aware verification, persistence, and loading for demand models."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    GradientBoostingRegressor,
    HistGradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import PoissonRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.services.demand_forecasting.features import (
    ALL_FEATURES,
    CATEGORICAL_FEATURES,
    FEATURE_SCHEMA_VERSION,
    NUMERIC_FEATURES,
    build_supervised_rows,
)
from app.services.demand_forecasting.synthetic import DemoDataset, WeeklyDemand

ARTIFACT_VERSION = 2
HORIZON_WEIGHTS = {1: 4.0, 2: 3.0, 3: 2.0, 4: 1.0}
BASELINE_METHODS = (
    "LAST_OBSERVED",
    "MOVING_AVERAGE_4",
    "WEIGHTED_MOVING_AVERAGE",
    "PHASE_EQUIPMENT_AVERAGE",
)


@dataclass
class DemandModelBundle:
    artifact_version: int
    version: str
    feature_schema_version: str
    unit_model: Pipeline | None
    hour_model: Pipeline | None
    unit_model_name: str
    hour_model_name: str
    unit_serving_method: str
    hour_serving_method: str
    unit_promoted: bool
    hour_promoted: bool
    unit_residual_low: float
    unit_residual_high: float
    hour_residual_low: float
    hour_residual_high: float
    unit_phase_equipment_means: dict[str, float]
    hour_phase_equipment_means: dict[str, float]
    metrics: dict[str, Any]
    promoted: bool
    synthetic_training: bool


def _preprocessor(*, scale_numeric: bool = False) -> ColumnTransformer:
    numeric_steps: list[tuple[str, Any]] = [("imputer", SimpleImputer(strategy="median"))]
    if scale_numeric:
        numeric_steps.append(("scaler", StandardScaler()))
    return ColumnTransformer(
        [
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
            ("numeric", Pipeline(numeric_steps), NUMERIC_FEATURES),
        ],
        remainder="drop",
    )


def _model_pipeline(
    name: str,
    *,
    target: str,
    n_estimators: int,
    random_state: int,
) -> Pipeline:
    if name == "HIST_GRADIENT_BOOSTING":
        estimator = HistGradientBoostingRegressor(
            loss="poisson" if target == "units" else "squared_error",
            learning_rate=0.06,
            max_iter=n_estimators,
            max_leaf_nodes=15,
            l2_regularization=0.2,
            random_state=random_state,
        )
    elif name == "GRADIENT_BOOSTING":
        estimator = GradientBoostingRegressor(
            n_estimators=n_estimators,
            max_depth=3,
            learning_rate=0.04,
            loss="huber",
            random_state=random_state,
        )
    elif name == "RANDOM_FOREST":
        estimator = RandomForestRegressor(
            n_estimators=max(80, min(n_estimators, 180)),
            min_samples_leaf=3,
            max_features=0.75,
            n_jobs=-1,
            random_state=random_state,
        )
    elif name == "POISSON_REGRESSION" and target == "units":
        estimator = PoissonRegressor(alpha=0.1, max_iter=600)
    else:
        raise ValueError(f"Unsupported {target} model: {name}")
    return Pipeline(
        [
            ("preprocess", _preprocessor(scale_numeric=name == "POISSON_REGRESSION")),
            ("model", estimator),
        ]
    )


def _wape(actual: np.ndarray, predicted: np.ndarray) -> float | None:
    denominator = float(np.abs(actual).sum())
    return float(np.abs(actual - predicted).sum() / denominator) if denominator else None


def _metric_block(
    actual: np.ndarray,
    predicted: np.ndarray,
    horizons: np.ndarray | None = None,
) -> dict[str, Any]:
    actual = np.asarray(actual, dtype=float)
    predicted = np.maximum(0.0, np.asarray(predicted, dtype=float))
    error = predicted - actual
    if horizons is None:
        weights = np.ones(len(actual), dtype=float)
    else:
        weights = np.asarray([HORIZON_WEIGHTS[int(value)] for value in horizons], dtype=float)
    wape = _wape(actual, predicted)
    under_error = np.maximum(actual - predicted, 0.0)
    over_error = np.maximum(predicted - actual, 0.0)
    return {
        "count": int(len(actual)),
        "mae": round(float(mean_absolute_error(actual, predicted)), 4),
        "horizonWeightedMae": round(float(np.average(np.abs(error), weights=weights)), 4),
        "wape": round(wape, 4) if wape is not None else None,
        "bias": round(float(np.mean(error)), 4),
        "underforecastRate": round(float(np.mean(error < 0)), 4),
        "overforecastRate": round(float(np.mean(error > 0)), 4),
        "shortageWeightedError": round(float(np.mean(under_error * 2.0 + over_error)), 4),
    }


def _phase_equipment_means(
    frame: pd.DataFrame,
    targets: np.ndarray,
) -> dict[str, float]:
    values = frame[["project_phase", "equipment_type"]].copy()
    values["target"] = targets
    result: dict[str, float] = {}
    for (phase, equipment), group in values.groupby(["project_phase", "equipment_type"]):
        result[f"{phase}|{equipment}"] = float(group["target"].mean())
    for equipment, group in values.groupby("equipment_type"):
        result[f"*|{equipment}"] = float(group["target"].mean())
    result["*|*"] = float(values["target"].mean()) if len(values) else 0.0
    return result


def _baseline_prediction(
    method: str,
    frame: pd.DataFrame,
    *,
    target: str,
    means: dict[str, float],
) -> np.ndarray:
    if target == "units":
        columns = {
            "LAST_OBSERVED": "lag_1",
            "MOVING_AVERAGE_4": "rolling_mean_4",
            "WEIGHTED_MOVING_AVERAGE": "weighted_mean_4",
        }
    else:
        columns = {
            "LAST_OBSERVED": "engine_hours_lag_1",
            "MOVING_AVERAGE_4": "rolling_engine_hours_4",
            "WEIGHTED_MOVING_AVERAGE": "weighted_engine_hours_4",
        }
    if method in columns:
        return np.maximum(0.0, frame[columns[method]].to_numpy(dtype=float))
    if method != "PHASE_EQUIPMENT_AVERAGE":
        raise ValueError(f"Unsupported baseline method: {method}")
    predictions = [
        means.get(
            f"{row.project_phase}|{row.equipment_type}",
            means.get(f"*|{row.equipment_type}", means.get("*|*", 0.0)),
        )
        for row in frame.itertuples()
    ]
    return np.maximum(0.0, np.asarray(predictions, dtype=float))


def predict_serving_method(
    method: str,
    frame: pd.DataFrame,
    *,
    target: str,
    model: Pipeline | None,
    phase_equipment_means: dict[str, float],
) -> np.ndarray:
    if method in BASELINE_METHODS:
        return _baseline_prediction(
            method,
            frame,
            target=target,
            means=phase_equipment_means,
        )
    if model is None:
        raise RuntimeError(f"The promoted {target} model is missing from the artifact")
    return np.maximum(0.0, model.predict(frame))


def _per_horizon(
    actual: np.ndarray,
    predicted: np.ndarray,
    horizons: np.ndarray,
) -> dict[str, Any]:
    report: dict[str, Any] = {}
    for horizon in sorted(set(int(value) for value in horizons)):
        mask = horizons == horizon
        report[f"week{horizon}"] = _metric_block(
            actual[mask], predicted[mask], horizons[mask]
        )
    return report


def _per_segment(
    frame: pd.DataFrame,
    actual: np.ndarray,
    predicted: np.ndarray,
    horizons: np.ndarray,
    column: str,
) -> dict[str, Any]:
    report: dict[str, Any] = {}
    for value in sorted(frame[column].astype(str).unique()):
        mask = frame[column].astype(str).to_numpy() == value
        if mask.sum() >= 5:
            report[value] = _metric_block(actual[mask], predicted[mask], horizons[mask])
    return report


def _candidate_results(
    *,
    target: str,
    frame: pd.DataFrame,
    targets: np.ndarray,
    train_indices: np.ndarray,
    test_indices: np.ndarray,
    horizons: np.ndarray,
    n_estimators: int,
    random_state: int,
) -> tuple[list[dict[str, Any]], dict[str, Pipeline], dict[str, np.ndarray]]:
    names = ["HIST_GRADIENT_BOOSTING", "GRADIENT_BOOSTING", "RANDOM_FOREST"]
    if target == "units":
        names.append("POISSON_REGRESSION")
    reports: list[dict[str, Any]] = []
    fitted: dict[str, Pipeline] = {}
    predictions: dict[str, np.ndarray] = {}
    for offset, name in enumerate(names):
        try:
            pipeline = _model_pipeline(
                name,
                target=target,
                n_estimators=n_estimators,
                random_state=random_state + offset,
            )
            pipeline.fit(frame.iloc[train_indices], targets[train_indices])
            prediction = np.maximum(0.0, pipeline.predict(frame.iloc[test_indices]))
            metrics = _metric_block(
                targets[test_indices], prediction, horizons[test_indices]
            )
            reports.append({"method": name, "kind": "model", **metrics})
            fitted[name] = pipeline
            predictions[name] = prediction
        except Exception as exc:  # noqa: BLE001
            reports.append({"method": name, "kind": "model", "error": str(exc)})
    successful = [item for item in reports if "horizonWeightedMae" in item]
    if not successful:
        raise RuntimeError(f"All {target} model candidates failed")
    return reports, fitted, predictions


def _baseline_results(
    *,
    target: str,
    frame: pd.DataFrame,
    targets: np.ndarray,
    train_indices: np.ndarray,
    test_indices: np.ndarray,
    horizons: np.ndarray,
) -> tuple[list[dict[str, Any]], dict[str, np.ndarray], dict[str, float]]:
    means = _phase_equipment_means(frame.iloc[train_indices], targets[train_indices])
    reports: list[dict[str, Any]] = []
    predictions: dict[str, np.ndarray] = {}
    for method in BASELINE_METHODS:
        prediction = _baseline_prediction(
            method,
            frame.iloc[test_indices],
            target=target,
            means=means,
        )
        predictions[method] = prediction
        reports.append(
            {
                "method": method,
                "kind": "baseline",
                **_metric_block(targets[test_indices], prediction, horizons[test_indices]),
            }
        )
    return reports, predictions, means


def _rolling_origin_report(
    *,
    target: str,
    method: str,
    frame: pd.DataFrame,
    targets: np.ndarray,
    weeks: np.ndarray,
    horizons: np.ndarray,
    n_estimators: int,
    random_state: int,
) -> list[dict[str, Any]]:
    unique_weeks = sorted(set(weeks))
    reports: list[dict[str, Any]] = []
    for fold, fraction in enumerate((0.55, 0.65, 0.75), start=1):
        cutoff_position = min(len(unique_weeks) - 2, max(1, int(len(unique_weeks) * fraction)))
        validation_end = min(
            len(unique_weeks),
            cutoff_position + max(2, int(len(unique_weeks) * 0.10)),
        )
        cutoff = unique_weeks[cutoff_position]
        end_week = unique_weeks[validation_end - 1]
        train_indices = np.flatnonzero(weeks < cutoff)
        validation_indices = np.flatnonzero((weeks >= cutoff) & (weeks <= end_week))
        if not len(train_indices) or not len(validation_indices):
            continue
        means = _phase_equipment_means(frame.iloc[train_indices], targets[train_indices])
        if method in BASELINE_METHODS:
            prediction = _baseline_prediction(
                method,
                frame.iloc[validation_indices],
                target=target,
                means=means,
            )
        else:
            model = _model_pipeline(
                method,
                target=target,
                n_estimators=n_estimators,
                random_state=random_state + fold,
            )
            model.fit(frame.iloc[train_indices], targets[train_indices])
            prediction = np.maximum(0.0, model.predict(frame.iloc[validation_indices]))
        reports.append(
            {
                "fold": fold,
                "trainThrough": unique_weeks[cutoff_position - 1].isoformat(),
                "validateFrom": cutoff.isoformat(),
                "validateThrough": end_week.isoformat(),
                **_metric_block(
                    targets[validation_indices],
                    prediction,
                    horizons[validation_indices],
                ),
            }
        )
    return reports


def _cohort_value(
    training_rows: list[WeeklyDemand],
    target: WeeklyDemand,
    value: Callable[[WeeklyDemand], float],
) -> tuple[float, str]:
    levels: list[tuple[str, Callable[[WeeklyDemand], bool]]] = [
        (
            "project_type_size_phase_equipment_region",
            lambda row: row.project_type == target.project_type
            and abs(row.project_size - target.project_size) <= max(40, target.project_size * 0.35)
            and row.project_phase == target.project_phase
            and row.equipment_type == target.equipment_type
            and row.region == target.region,
        ),
        (
            "project_type_phase_equipment",
            lambda row: row.project_type == target.project_type
            and row.project_phase == target.project_phase
            and row.equipment_type == target.equipment_type,
        ),
        (
            "phase_equipment",
            lambda row: row.project_phase == target.project_phase
            and row.equipment_type == target.equipment_type,
        ),
        (
            "project_type_equipment",
            lambda row: row.project_type == target.project_type
            and row.equipment_type == target.equipment_type,
        ),
        ("equipment", lambda row: row.equipment_type == target.equipment_type),
    ]
    for label, predicate in levels:
        matches = [value(row) for row in training_rows if predicate(row)]
        if len(matches) >= 8:
            return float(np.mean(matches)), label
    return 0.0, "no_comparable_history"


def _cold_start_report(dataset: DemoDataset) -> dict[str, Any]:
    project_ids = sorted({row.project_id for row in dataset.weekly_demand})
    held_projects = set(project_ids[::5])
    training_rows = [
        row for row in dataset.weekly_demand if row.project_id not in held_projects
    ]
    held_rows = [
        row for row in dataset.weekly_demand if row.project_id in held_projects
    ]
    unit_actual: list[float] = []
    unit_prediction: list[float] = []
    hour_actual: list[float] = []
    hour_prediction: list[float] = []
    fallback_counts: dict[str, int] = {}
    for row in held_rows:
        predicted_units, label = _cohort_value(
            training_rows, row, lambda item: float(item.requested_units)
        )
        predicted_hours, _ = _cohort_value(
            training_rows, row, lambda item: float(item.engine_hours)
        )
        unit_actual.append(float(row.requested_units))
        unit_prediction.append(predicted_units)
        hour_actual.append(float(row.engine_hours))
        hour_prediction.append(predicted_hours)
        fallback_counts[label] = fallback_counts.get(label, 0) + 1
    return {
        "strategy": "project_holdout_cohort_fallback",
        "heldOutProjectIds": sorted(held_projects),
        "rows": len(held_rows),
        "units": _metric_block(np.asarray(unit_actual), np.asarray(unit_prediction)),
        "machineHours": _metric_block(np.asarray(hour_actual), np.asarray(hour_prediction)),
        "fallbackCounts": fallback_counts,
    }


def _select(
    model_reports: list[dict[str, Any]],
    baseline_reports: list[dict[str, Any]],
) -> dict[str, Any]:
    valid = [
        item
        for item in model_reports + baseline_reports
        if "horizonWeightedMae" in item
    ]
    return min(
        valid,
        key=lambda item: (
            item["horizonWeightedMae"],
            0 if item["kind"] == "baseline" else 1,
            item["method"],
        ),
    )


def train_demand_bundle(
    dataset: DemoDataset,
    *,
    n_estimators: int = 160,
    random_state: int = 42,
) -> DemandModelBundle:
    features, unit_targets, hour_targets, target_weeks = build_supervised_rows(
        dataset.weekly_demand
    )
    if len(features) < 100:
        raise ValueError("At least 100 direct-horizon rows are required")

    frame = pd.DataFrame(features, columns=ALL_FEATURES)
    unit_array = np.asarray(unit_targets, dtype=float)
    hour_array = np.asarray(hour_targets, dtype=float)
    week_array = np.asarray(target_weeks)
    horizon_array = frame["forecast_horizon"].to_numpy(dtype=int)
    unique_weeks = sorted(set(target_weeks))
    selection_start = unique_weeks[max(1, int(len(unique_weeks) * 0.65))]
    holdout_start = unique_weeks[max(2, int(len(unique_weeks) * 0.8))]
    development_indices = np.flatnonzero(week_array < selection_start)
    selection_indices = np.flatnonzero(
        (week_array >= selection_start) & (week_array < holdout_start)
    )
    pre_holdout_indices = np.flatnonzero(week_array < holdout_start)
    holdout_indices = np.flatnonzero(week_array >= holdout_start)
    if not all(
        len(indices)
        for indices in (
            development_indices,
            selection_indices,
            pre_holdout_indices,
            holdout_indices,
        )
    ):
        raise ValueError("Chronological development, selection, or holdout window is empty")

    unit_candidates, unit_models, unit_model_predictions = _candidate_results(
        target="units",
        frame=frame,
        targets=unit_array,
        train_indices=development_indices,
        test_indices=selection_indices,
        horizons=horizon_array,
        n_estimators=n_estimators,
        random_state=random_state,
    )
    hour_candidates, hour_models, hour_model_predictions = _candidate_results(
        target="hours",
        frame=frame,
        targets=hour_array,
        train_indices=development_indices,
        test_indices=selection_indices,
        horizons=horizon_array,
        n_estimators=n_estimators,
        random_state=random_state + 100,
    )
    unit_baselines, unit_baseline_predictions, unit_means = _baseline_results(
        target="units",
        frame=frame,
        targets=unit_array,
        train_indices=development_indices,
        test_indices=selection_indices,
        horizons=horizon_array,
    )
    hour_baselines, hour_baseline_predictions, hour_means = _baseline_results(
        target="hours",
        frame=frame,
        targets=hour_array,
        train_indices=development_indices,
        test_indices=selection_indices,
        horizons=horizon_array,
    )

    unit_selection_winner = _select(unit_candidates, unit_baselines)
    hour_selection_winner = _select(hour_candidates, hour_baselines)
    best_unit_model_report = _select(unit_candidates, [])
    best_hour_model_report = _select(hour_candidates, [])
    unit_model_name = best_unit_model_report["method"]
    hour_model_name = best_hour_model_report["method"]
    unit_fallback = _select([], unit_baselines)["method"]
    hour_fallback = _select([], hour_baselines)["method"]

    unit_model = _model_pipeline(
        unit_model_name,
        target="units",
        n_estimators=n_estimators,
        random_state=random_state + 400,
    )
    hour_model = _model_pipeline(
        hour_model_name,
        target="hours",
        n_estimators=n_estimators,
        random_state=random_state + 500,
    )
    unit_model.fit(frame.iloc[pre_holdout_indices], unit_array[pre_holdout_indices])
    hour_model.fit(frame.iloc[pre_holdout_indices], hour_array[pre_holdout_indices])
    unit_means = _phase_equipment_means(
        frame.iloc[pre_holdout_indices], unit_array[pre_holdout_indices]
    )
    hour_means = _phase_equipment_means(
        frame.iloc[pre_holdout_indices], hour_array[pre_holdout_indices]
    )
    holdout_frame = frame.iloc[holdout_indices].reset_index(drop=True)
    holdout_horizons = horizon_array[holdout_indices]
    actual_units = unit_array[holdout_indices]
    actual_hours = hour_array[holdout_indices]
    unit_model_holdout = np.maximum(0.0, unit_model.predict(holdout_frame))
    hour_model_holdout = np.maximum(0.0, hour_model.predict(holdout_frame))
    unit_fallback_holdout = _baseline_prediction(
        unit_fallback,
        holdout_frame,
        target="units",
        means=unit_means,
    )
    hour_fallback_holdout = _baseline_prediction(
        hour_fallback,
        holdout_frame,
        target="hours",
        means=hour_means,
    )
    unit_model_holdout_metrics = _metric_block(
        actual_units, unit_model_holdout, holdout_horizons
    )
    hour_model_holdout_metrics = _metric_block(
        actual_hours, hour_model_holdout, holdout_horizons
    )
    unit_fallback_holdout_metrics = _metric_block(
        actual_units, unit_fallback_holdout, holdout_horizons
    )
    hour_fallback_holdout_metrics = _metric_block(
        actual_hours, hour_fallback_holdout, holdout_horizons
    )
    unit_promoted = (
        unit_selection_winner["kind"] == "model"
        and unit_model_holdout_metrics["horizonWeightedMae"]
        <= unit_fallback_holdout_metrics["horizonWeightedMae"]
    )
    hour_promoted = (
        hour_selection_winner["kind"] == "model"
        and hour_model_holdout_metrics["horizonWeightedMae"]
        <= hour_fallback_holdout_metrics["horizonWeightedMae"]
    )
    unit_method = unit_model_name if unit_promoted else unit_fallback
    hour_method = hour_model_name if hour_promoted else hour_fallback
    unit_prediction = unit_model_holdout if unit_promoted else unit_fallback_holdout
    hour_prediction = hour_model_holdout if hour_promoted else hour_fallback_holdout
    unit_calibration_prediction = (
        unit_model_predictions[unit_model_name]
        if unit_promoted
        else unit_baseline_predictions[unit_fallback]
    )
    hour_calibration_prediction = (
        hour_model_predictions[hour_model_name]
        if hour_promoted
        else hour_baseline_predictions[hour_fallback]
    )
    unit_residuals = unit_array[selection_indices] - unit_calibration_prediction
    hour_residuals = hour_array[selection_indices] - hour_calibration_prediction
    unit_residual_low = float(np.quantile(unit_residuals, 0.10))
    unit_residual_high = float(np.quantile(unit_residuals, 0.90))
    hour_residual_low = float(np.quantile(hour_residuals, 0.10))
    hour_residual_high = float(np.quantile(hour_residuals, 0.90))

    unit_interval_coverage = float(
        np.mean(
            (actual_units >= np.maximum(0.0, unit_prediction + unit_residual_low))
            & (actual_units <= unit_prediction + unit_residual_high)
        )
    )
    hour_interval_coverage = float(
        np.mean(
            (actual_hours >= np.maximum(0.0, hour_prediction + hour_residual_low))
            & (actual_hours <= hour_prediction + hour_residual_high)
        )
    )

    unit_report = {
        "servingMethod": unit_method,
        "selectionWinner": unit_selection_winner["method"],
        "selectionWinnerKind": unit_selection_winner["kind"],
        "modelPromoted": unit_promoted,
        "promotionGate": {
            "rule": "selection-window model must not lose to selected baseline on untouched holdout",
            "candidateModel": {
                "method": unit_model_name,
                **unit_model_holdout_metrics,
            },
            "fallbackBaseline": {
                "method": unit_fallback,
                **unit_fallback_holdout_metrics,
            },
            "passed": unit_promoted,
        },
        "finalHoldout": _metric_block(actual_units, unit_prediction, holdout_horizons),
        "interval": {
            "calibrationQuantiles": [0.10, 0.90],
            "holdoutCoverage": round(unit_interval_coverage, 4),
        },
        "candidateModels": unit_candidates,
        "baselines": unit_baselines,
        "byHorizon": _per_horizon(actual_units, unit_prediction, holdout_horizons),
        "byEquipmentType": _per_segment(
            holdout_frame,
            actual_units,
            unit_prediction,
            holdout_horizons,
            "equipment_type",
        ),
        "byProjectPhase": _per_segment(
            holdout_frame,
            actual_units,
            unit_prediction,
            holdout_horizons,
            "project_phase",
        ),
        "byRegion": _per_segment(
            holdout_frame,
            actual_units,
            unit_prediction,
            holdout_horizons,
            "region",
        ),
        "rollingOrigins": _rolling_origin_report(
            target="units",
            method=unit_method,
            frame=frame,
            targets=unit_array,
            weeks=week_array,
            horizons=horizon_array,
            n_estimators=n_estimators,
            random_state=random_state + 200,
        ),
    }
    hour_report = {
        "servingMethod": hour_method,
        "selectionWinner": hour_selection_winner["method"],
        "selectionWinnerKind": hour_selection_winner["kind"],
        "modelPromoted": hour_promoted,
        "promotionGate": {
            "rule": "selection-window model must not lose to selected baseline on untouched holdout",
            "candidateModel": {
                "method": hour_model_name,
                **hour_model_holdout_metrics,
            },
            "fallbackBaseline": {
                "method": hour_fallback,
                **hour_fallback_holdout_metrics,
            },
            "passed": hour_promoted,
        },
        "finalHoldout": _metric_block(actual_hours, hour_prediction, holdout_horizons),
        "interval": {
            "calibrationQuantiles": [0.10, 0.90],
            "holdoutCoverage": round(hour_interval_coverage, 4),
        },
        "candidateModels": hour_candidates,
        "baselines": hour_baselines,
        "byHorizon": _per_horizon(actual_hours, hour_prediction, holdout_horizons),
        "byEquipmentType": _per_segment(
            holdout_frame,
            actual_hours,
            hour_prediction,
            holdout_horizons,
            "equipment_type",
        ),
        "byProjectPhase": _per_segment(
            holdout_frame,
            actual_hours,
            hour_prediction,
            holdout_horizons,
            "project_phase",
        ),
        "byRegion": _per_segment(
            holdout_frame,
            actual_hours,
            hour_prediction,
            holdout_horizons,
            "region",
        ),
        "rollingOrigins": _rolling_origin_report(
            target="hours",
            method=hour_method,
            frame=frame,
            targets=hour_array,
            weeks=week_array,
            horizons=horizon_array,
            n_estimators=n_estimators,
            random_state=random_state + 300,
        ),
    }
    version = (
        f"demand-direct-v2-{dataset.seed}-"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    metrics = {
        "verificationStatus": "SYNTHETIC_ENGINEERING_EVIDENCE_ONLY",
        "validation": {
            "strategy": (
                "chronological_development_selection_calibration_then_untouched_holdout"
                "_plus_three_rolling_origins"
            ),
            "selectionObjective": "minimum_horizon_weighted_mae",
            "horizonWeights": HORIZON_WEIGHTS,
            "developmentRows": int(len(development_indices)),
            "selectionCalibrationRows": int(len(selection_indices)),
            "preHoldoutRefitRows": int(len(pre_holdout_indices)),
            "holdoutRows": int(len(holdout_indices)),
            "selectionStart": selection_start.isoformat(),
            "holdoutStart": holdout_start.isoformat(),
            "holdoutEnd": max(target_weeks).isoformat(),
            "directHorizons": [1, 2, 3, 4],
        },
        "units": unit_report,
        "machineHours": hour_report,
        "coldStart": _cold_start_report(dataset),
        "warning": (
            "All reported metrics are deterministic synthetic engineering results, "
            "not evidence of real customer-demand accuracy."
        ),
        "productionGate": (
            "Shadow backtesting on real requested demand is required before production promotion."
        ),
    }
    return DemandModelBundle(
        artifact_version=ARTIFACT_VERSION,
        version=version,
        feature_schema_version=FEATURE_SCHEMA_VERSION,
        unit_model=unit_model if unit_promoted else None,
        hour_model=hour_model if hour_promoted else None,
        unit_model_name=unit_model_name,
        hour_model_name=hour_model_name,
        unit_serving_method=unit_method,
        hour_serving_method=hour_method,
        unit_promoted=unit_promoted,
        hour_promoted=hour_promoted,
        unit_residual_low=unit_residual_low,
        unit_residual_high=unit_residual_high,
        hour_residual_low=hour_residual_low,
        hour_residual_high=hour_residual_high,
        unit_phase_equipment_means=unit_means,
        hour_phase_equipment_means=hour_means,
        metrics=metrics,
        promoted=(unit_promoted or hour_promoted),
        synthetic_training=True,
    )


def save_demand_bundle(bundle: DemandModelBundle, directory: str | Path) -> dict[str, Any]:
    output_dir = Path(directory)
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "demand_model.joblib"
    meta_path = output_dir / "model_meta.json"
    joblib.dump(bundle, model_path)
    metadata = {
        "artifactVersion": bundle.artifact_version,
        "version": bundle.version,
        "featureSchemaVersion": bundle.feature_schema_version,
        "unitServingMethod": bundle.unit_serving_method,
        "hourServingMethod": bundle.hour_serving_method,
        "unitModelPromoted": bundle.unit_promoted,
        "hourModelPromoted": bundle.hour_promoted,
        "syntheticTraining": bundle.synthetic_training,
        "unitResidualBand": [bundle.unit_residual_low, bundle.unit_residual_high],
        "hourResidualBand": [bundle.hour_residual_low, bundle.hour_residual_high],
        "metrics": bundle.metrics,
        "modelPath": str(model_path),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def load_demand_bundle(directory: str | Path) -> DemandModelBundle | None:
    model_path = Path(directory) / "demand_model.joblib"
    if not model_path.exists():
        return None
    bundle = joblib.load(model_path)
    if not isinstance(bundle, DemandModelBundle):
        raise TypeError("Demand artifact has an incompatible bundle type")
    if bundle.artifact_version != ARTIFACT_VERSION:
        raise ValueError("Demand artifact version is incompatible; retraining is required")
    if bundle.feature_schema_version != FEATURE_SCHEMA_VERSION:
        raise ValueError("Demand artifact feature schema is incompatible; retraining is required")
    return bundle
