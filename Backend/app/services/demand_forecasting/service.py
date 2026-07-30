"""Demand-forecasting application service.

Synthetic mode is an explicit, deterministic demo adapter. Production mode is
reserved for the PostgreSQL repository and real identity-provider integration.
"""
from __future__ import annotations

from dataclasses import asdict, replace
from datetime import datetime, timezone
from threading import RLock
from typing import Any

from app.config import get_settings
from app.schemas.demand import (
    DealerActionDecisionIn,
    ForecastOverrideIn,
    ManualReviewIn,
    RecommendationFeedbackIn,
    RetrainDemandModelIn,
    SyntheticGenerateIn,
)
from app.security.demand_access import Principal
from app.services.demand_forecasting.dealer import build_dealer_view
from app.services.demand_forecasting.forecasting import (
    ForecastPoint,
    forecast_point_dict,
    forecast_project_equipment,
    project_history,
)
from app.services.demand_forecasting.modeling import (
    DemandModelBundle,
    load_demand_bundle,
    save_demand_bundle,
    train_demand_bundle,
)
from app.services.demand_forecasting.recommendations import recommend_packages
from app.services.demand_forecasting.synthetic import (
    DemoDataset,
    ProjectSpec,
    WeeklyDemand,
    generate_demo_dataset,
)


class DemandForecastingService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._lock = RLock()
        self._dataset: DemoDataset | None = None
        self._bundle: DemandModelBundle | None = None
        self._bundle_error: str | None = None
        self._overrides: dict[int, dict[str, Any]] = {}
        self._feedback: list[dict[str, Any]] = []
        self._manual_reviews: list[dict[str, Any]] = []
        self._action_decisions: dict[int, dict[str, Any]] = {}
        self._idempotency: dict[str, dict[str, Any]] = {}

    def _ensure_loaded(self) -> None:
        with self._lock:
            if self._dataset is None:
                self._dataset = generate_demo_dataset(seed=self.settings.demand_synthetic_seed)
            if self._bundle is None and self._bundle_error is None:
                try:
                    self._bundle = load_demand_bundle(self.settings.demand_model_dir)
                except Exception as exc:  # noqa: BLE001
                    self._bundle_error = str(exc)

    @property
    def dataset(self) -> DemoDataset:
        self._ensure_loaded()
        assert self._dataset is not None
        return self._dataset

    @property
    def bundle(self) -> DemandModelBundle | None:
        self._ensure_loaded()
        return self._bundle

    def status(self) -> dict[str, Any]:
        dataset = self.dataset
        return {
            "service": "demand-forecasting",
            "ready": True,
            "dataMode": self.settings.demand_data_mode,
            "synthetic": True,
            "modelLoaded": self.bundle is not None,
            "modelPromoted": bool(self.bundle and self.bundle.promoted),
            "unitModelPromoted": bool(self.bundle and self.bundle.unit_promoted),
            "hourModelPromoted": bool(self.bundle and self.bundle.hour_promoted),
            "modelVersion": self.bundle.version if self.bundle else "baseline-v1",
            "modelError": self._bundle_error,
            "servingMethods": {
                "units": (
                    self.bundle.unit_serving_method
                    if self.bundle
                    else "WEIGHTED_MOVING_AVERAGE"
                ),
                "machineHours": (
                    self.bundle.hour_serving_method
                    if self.bundle
                    else "WEIGHTED_MOVING_AVERAGE"
                ),
            },
            "manifest": dataset.manifest(),
            "warning": "Synthetic demo behavior; not measured business performance.",
        }

    @staticmethod
    def _project_dict(project: ProjectSpec) -> dict[str, Any]:
        return {
            "projectId": project.project_id,
            "customerId": project.customer_id,
            "siteId": project.site_id,
            "projectCode": project.project_code,
            "projectName": project.project_name,
            "projectType": project.project_type,
            "projectSize": project.project_size,
            "projectSizeUnit": project.project_size_unit,
            "region": project.region,
            "currentPhase": project.current_phase,
            "phaseStartDate": project.phase_start_date.isoformat(),
            "phaseEndDate": project.phase_end_date.isoformat(),
            "expectedProjectEnd": project.expected_project_end.isoformat(),
            "projectStatus": project.project_status,
            "progressPercentage": project.progress_percentage,
            "priority": project.priority,
            "scenario": project.scenario,
        }

    def get_project(self, project_id: int) -> ProjectSpec | None:
        return next((project for project in self.dataset.projects if project.project_id == project_id), None)

    def equipment_types_for_project(self, project: ProjectSpec) -> list[str]:
        types = sorted(
            {
                row.equipment_type
                for row in self.dataset.weekly_demand
                if row.project_id == project.project_id
            }
        )
        if types:
            return types
        cold_start_by_type = {
            "Public Infrastructure": ["Crane", "Excavator", "Wheel Loader"],
            "Commercial Building": ["Crane", "Excavator"],
            "Road Construction": ["Motor Grader", "Compactor", "Bulldozer"],
            "Mine Expansion": ["Excavator", "Dump Truck", "Wheel Loader"],
            "Pipeline": ["Excavator", "Bulldozer"],
        }
        return cold_start_by_type.get(project.project_type, ["Excavator"])

    def _base_points(self, project: ProjectSpec, equipment_type: str) -> list[ForecastPoint]:
        return forecast_project_equipment(
            self.dataset,
            project,
            equipment_type,
            self.bundle,
            horizon_weeks=4,
        )

    def _apply_overrides(self, points: list[ForecastPoint]) -> list[ForecastPoint]:
        adjusted: list[ForecastPoint] = []
        for point in points:
            override = self._overrides.get(point.forecast_id)
            if not override:
                adjusted.append(point)
                continue
            units = float(override["adjustedUnits"])
            hours = float(override["adjustedMachineHours"])
            adjusted.append(
                replace(
                    point,
                    predicted_units=units,
                    predicted_machine_hours=hours,
                    safe_planning_units=max(point.safe_planning_units, int(round(units))),
                    version=int(override["version"]),
                    explanation=(
                        f"{point.explanation} A customer planning override changed the expected "
                        f"value to {units:.1f} units and {hours:.0f} machine-hours."
                    ),
                )
            )
        return adjusted

    @staticmethod
    def _history_dict(row: WeeklyDemand) -> dict[str, Any]:
        total = row.engine_hours + row.idle_hours
        return {
            "weekStart": row.week_start.isoformat(),
            "requestedUnits": row.requested_units,
            "fulfilledUnits": row.fulfilled_units,
            "unmetUnits": row.requested_units - row.fulfilled_units,
            "rentedUnits": row.rented_units,
            "engineHours": row.engine_hours,
            "idleHours": row.idle_hours,
            "operatingUtilization": round(row.engine_hours / total, 4) if total else None,
            "projectPhase": row.project_phase,
        }

    def list_projects(self, company_id: int | None = None) -> dict[str, Any]:
        projects = [
            project
            for project in self.dataset.projects
            if project.project_status in {"ACTIVE", "PLANNED"}
            and (company_id is None or project.customer_id == company_id)
        ]
        return {
            "success": True,
            "projects": [
                {
                    **self._project_dict(project),
                    "equipmentTypes": self.equipment_types_for_project(project),
                }
                for project in projects
            ],
            **self._response_meta(),
        }

    def equipment_forecast(self, project_id: int, equipment_type: str) -> dict[str, Any]:
        project = self.get_project(project_id)
        if not project:
            raise KeyError("Project not found")
        supported = self.equipment_types_for_project(project)
        if equipment_type not in supported:
            raise ValueError(f"{equipment_type} is not configured for this project")
        history = project_history(self.dataset, project_id, equipment_type)
        points = self._apply_overrides(self._base_points(project, equipment_type))
        return {
            "success": True,
            "project": self._project_dict(project),
            "equipmentType": equipment_type,
            "history": [self._history_dict(row) for row in history[-12:]],
            "forecast": [forecast_point_dict(point) for point in points],
            "summary": self._summary(points, history),
            **self._response_meta(),
        }

    def project_forecast(self, project_id: int) -> dict[str, Any]:
        project = self.get_project(project_id)
        if not project:
            raise KeyError("Project not found")
        equipment = []
        for equipment_type in self.equipment_types_for_project(project):
            response = self.equipment_forecast(project_id, equipment_type)
            equipment.append(
                {
                    "equipmentType": equipment_type,
                    "summary": response["summary"],
                    "forecast": response["forecast"],
                }
            )
        return {
            "success": True,
            "project": self._project_dict(project),
            "equipment": equipment,
            **self._response_meta(),
        }

    @staticmethod
    def _summary(points: list[ForecastPoint], history: list[WeeklyDemand]) -> dict[str, Any]:
        recent = history[-4:]
        engine = sum(row.engine_hours for row in recent)
        idle = sum(row.idle_hours for row in recent)
        current_utilization = engine / (engine + idle) if engine + idle else None
        return {
            "weekOneExpectedUnits": points[0].predicted_units,
            "weekOneSafeUnits": points[0].safe_planning_units,
            "fourWeekMachineHours": round(sum(point.predicted_machine_hours for point in points), 2),
            "currentUtilization": round(current_utilization, 4) if current_utilization is not None else None,
            "idleCapacity": round(1 - current_utilization, 4) if current_utilization is not None else None,
            "trend": points[0].trend,
            "confidence": points[0].confidence,
            "coldStart": points[0].cold_start,
        }

    def package_recommendations(
        self,
        project_id: int,
        equipment_type: str,
        preference: str = "BALANCED",
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        if not project:
            raise KeyError("Project not found")
        if preference not in {"BALANCED", "COST", "AVAILABILITY"}:
            raise ValueError("Preference must be BALANCED, COST, or AVAILABILITY")
        history = project_history(self.dataset, project_id, equipment_type)
        points = self._apply_overrides(self._base_points(project, equipment_type))
        recommendation = recommend_packages(
            self.dataset, project, equipment_type, points, history, preference
        )
        stored = next(
            (
                item
                for item in reversed(self._feedback)
                if item.get("recommendationId") == recommendation.get("recommendationId")
            ),
            None,
        )
        if stored:
            recommendation["decision"] = stored["decision"]
        return {
            "success": True,
            "projectId": project_id,
            "equipmentType": equipment_type,
            "recommendation": recommendation,
            **self._response_meta(),
        }

    def dealer_view(
        self,
        region: str | None = None,
        equipment_type: str | None = None,
        forecast_week: str | None = None,
        confidence: str | None = None,
    ) -> dict[str, Any]:
        projects = [
            project for project in self.dataset.projects if project.project_status in {"ACTIVE", "PLANNED"}
        ]
        forecast_map: dict[int, dict[str, list[ForecastPoint]]] = {}
        for project in projects:
            forecast_map[project.project_id] = {
                item: self._apply_overrides(self._base_points(project, item))
                for item in self.equipment_types_for_project(project)
            }
        view = build_dealer_view(
            self.dataset,
            forecast_map,
            lambda project_id: self.get_project(project_id),
        )
        rows = view["rows"]
        if region:
            rows = [row for row in rows if row["region"] == region]
        if equipment_type:
            rows = [row for row in rows if row["equipmentType"] == equipment_type]
        if forecast_week:
            rows = [row for row in rows if row["forecastWeek"] == forecast_week]
        if confidence:
            rows = [row for row in rows if row["confidence"] == confidence]
        actions = view["actions"]
        for action in actions:
            decision = self._action_decisions.get(action["actionId"])
            if decision:
                action.update(decision)
        view["rows"] = rows
        view["actions"] = actions
        return {"success": True, **view, **self._response_meta()}

    def metrics(self) -> dict[str, Any]:
        if self.bundle:
            metrics = self.bundle.metrics
        else:
            metrics = {
                "status": "BASELINE_ONLY",
                "message": "No compatible demand artifact is loaded; weighted moving averages are active.",
                "warning": "Synthetic demo behavior; not measured business performance.",
            }
        return {
            "success": True,
            "modelVersion": self.bundle.version if self.bundle else "baseline-v1",
            "promoted": bool(self.bundle and self.bundle.promoted),
            "unitModelPromoted": bool(self.bundle and self.bundle.unit_promoted),
            "hourModelPromoted": bool(self.bundle and self.bundle.hour_promoted),
            "servingMethods": {
                "units": (
                    self.bundle.unit_serving_method
                    if self.bundle
                    else "WEIGHTED_MOVING_AVERAGE"
                ),
                "machineHours": (
                    self.bundle.hour_serving_method
                    if self.bundle
                    else "WEIGHTED_MOVING_AVERAGE"
                ),
            },
            "metrics": metrics,
            "datasetManifest": self.dataset.manifest(),
        }

    def explanation(self, forecast_id: int) -> dict[str, Any]:
        for project in self.dataset.projects:
            if project.project_status not in {"ACTIVE", "PLANNED"}:
                continue
            for equipment_type in self.equipment_types_for_project(project):
                for point in self._apply_overrides(self._base_points(project, equipment_type)):
                    if point.forecast_id == forecast_id:
                        return {
                            "success": True,
                            "forecastId": forecast_id,
                            "facts": {
                                "projectPhase": project.current_phase,
                                "equipmentType": equipment_type,
                                "expectedUnits": point.predicted_units,
                                "range": [point.lower_units, point.upper_units],
                                "machineHours": point.predicted_machine_hours,
                                "confidence": point.confidence,
                                "method": point.forecast_method,
                                "coldStart": point.cold_start,
                            },
                            "explanation": point.explanation,
                            **self._response_meta(),
                        }
        raise KeyError("Forecast not found")

    def override_forecast(
        self,
        body: ForecastOverrideIn,
        principal: Principal,
        idempotency_key: str,
    ) -> dict[str, Any]:
        with self._lock:
            if idempotency_key in self._idempotency:
                return self._idempotency[idempotency_key]
            current = self.explanation(body.forecastId)
            existing = self._overrides.get(body.forecastId)
            current_version = int(existing["version"]) if existing else 1
            if body.expectedVersion != current_version:
                raise RuntimeError(f"Forecast version changed; current version is {current_version}")
            record = {
                "overrideId": len(self._overrides) + 1,
                "forecastId": body.forecastId,
                "originalUnits": current["facts"]["expectedUnits"],
                "adjustedUnits": body.adjustedUnits,
                "originalMachineHours": current["facts"]["machineHours"],
                "adjustedMachineHours": body.adjustedMachineHours,
                "actorId": principal.actor_id,
                "actorRole": principal.role.value,
                "reason": body.reason,
                "version": current_version + 1,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            self._overrides[body.forecastId] = record
            response = {"success": True, "override": record}
            self._idempotency[idempotency_key] = response
            return response

    def record_feedback(
        self,
        body: RecommendationFeedbackIn,
        principal: Principal,
        idempotency_key: str,
    ) -> dict[str, Any]:
        with self._lock:
            if idempotency_key in self._idempotency:
                return self._idempotency[idempotency_key]
            record = {
                "feedbackId": len(self._feedback) + 1,
                "recommendationId": body.recommendationId,
                "forecastId": body.forecastId,
                "decision": body.decision,
                "rejectionReason": body.rejectionReason,
                "selectedPackageCode": body.selectedPackageCode,
                "details": body.details,
                "actorId": principal.actor_id,
                "actorRole": principal.role.value,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            self._feedback.append(record)
            response = {"success": True, "feedback": record}
            self._idempotency[idempotency_key] = response
            return response

    def request_manual_review(
        self,
        body: ManualReviewIn,
        principal: Principal,
        idempotency_key: str,
    ) -> dict[str, Any]:
        with self._lock:
            if idempotency_key in self._idempotency:
                return self._idempotency[idempotency_key]
            self.explanation(body.forecastId)
            record = {
                "reviewId": len(self._manual_reviews) + 1,
                "forecastId": body.forecastId,
                "reason": body.reason,
                "urgency": body.urgency,
                "status": "OPEN",
                "actorId": principal.actor_id,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            self._manual_reviews.append(record)
            response = {"success": True, "manualReview": record}
            self._idempotency[idempotency_key] = response
            return response

    def decide_dealer_action(
        self,
        action_id: int,
        body: DealerActionDecisionIn,
        principal: Principal,
        idempotency_key: str,
    ) -> dict[str, Any]:
        with self._lock:
            if idempotency_key in self._idempotency:
                return self._idempotency[idempotency_key]
            current = self._action_decisions.get(action_id)
            current_version = int(current["version"]) if current else 1
            if body.expectedVersion != current_version:
                raise RuntimeError(f"Action version changed; current version is {current_version}")
            record = {
                "status": body.decision,
                "decisionReason": body.reason,
                "approvedBy": principal.actor_id if body.decision == "APPROVED" else None,
                "decidedAt": datetime.now(timezone.utc).isoformat(),
                "version": current_version + 1,
            }
            self._action_decisions[action_id] = record
            response = {"success": True, "actionId": action_id, **record}
            self._idempotency[idempotency_key] = response
            return response

    def regenerate_synthetic(self, body: SyntheticGenerateIn) -> dict[str, Any]:
        with self._lock:
            self._dataset = generate_demo_dataset(
                seed=body.seed,
                project_count=body.projectCount,
                weeks=body.weeks,
            )
            self._overrides.clear()
            self._feedback.clear()
            return {"success": True, "manifest": self._dataset.manifest()}

    def retrain(self, body: RetrainDemandModelIn) -> dict[str, Any]:
        dataset = generate_demo_dataset(seed=body.seed)
        bundle = train_demand_bundle(
            dataset,
            n_estimators=body.nEstimators,
            random_state=body.randomState,
        )
        metadata = save_demand_bundle(bundle, self.settings.demand_model_dir)
        with self._lock:
            self._dataset = dataset
            self._bundle = bundle
            self._bundle_error = None
        return {"success": True, "model": metadata}

    def legacy_forecast(self, equipment_type: str, horizon_days: int = 7) -> dict[str, Any]:
        project = next(
            project for project in self.dataset.projects if project.project_status == "ACTIVE"
        )
        points = self._apply_overrides(self._base_points(project, equipment_type))
        return {
            "equipmentType": equipment_type,
            "horizonDays": horizon_days,
            "forecast": [forecast_point_dict(point) for point in points],
            "deprecated": True,
            "message": "Use /api/demand/projects/{project_id}/equipment/{equipment_type}.",
            **self._response_meta(),
        }

    def _response_meta(self) -> dict[str, Any]:
        return {
            "asOf": self.dataset.as_of.isoformat(),
            "forecastRunId": f"DEMO-{self.dataset.seed}-{self.dataset.as_of.isoformat()}",
            "modelVersion": self.bundle.version if self.bundle else "baseline-v1",
            "servingMethods": {
                "units": (
                    self.bundle.unit_serving_method
                    if self.bundle
                    else "WEIGHTED_MOVING_AVERAGE"
                ),
                "machineHours": (
                    self.bundle.hour_serving_method
                    if self.bundle
                    else "WEIGHTED_MOVING_AVERAGE"
                ),
            },
            "dataMode": "synthetic",
            "pricingMode": "simulated",
            "warning": "Synthetic demo behavior and simulated pricing; not measured business performance.",
        }


demand_service = DemandForecastingService()
