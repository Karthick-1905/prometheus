"""Demand forecasting, package recommendation, and dealer planning APIs."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response

from app.schemas.demand import (
    DealerActionDecisionIn,
    ForecastOverrideIn,
    ManualReviewIn,
    RecommendationFeedbackIn,
    RetrainDemandModelIn,
    SyntheticGenerateIn,
)
from app.security.demand_access import (
    ForecastRole,
    Principal,
    ensure_customer_access,
    ensure_dealer_access,
    get_demand_principal,
)
from app.services.demand_forecasting import demand_service

router = APIRouter(prefix="/api/demand", tags=["Demand Forecasting"])


def _idempotency(value: Optional[str]) -> str:
    if not value or len(value) < 8 or len(value) > 160:
        raise HTTPException(
            status_code=400,
            detail="Idempotency-Key header is required and must contain 8-160 characters.",
        )
    return value


def _project_and_scope(project_id: int, principal: Principal):
    project = demand_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not principal.is_dealer:
        ensure_customer_access(principal, project.customer_id)
    return project


def _map_forecast_error(exc: Exception) -> HTTPException:
    if isinstance(exc, KeyError):
        return HTTPException(status_code=404, detail=str(exc).strip("'"))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, RuntimeError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=500, detail="Demand service failed")


@router.get("/status")
def status():
    return demand_service.status()


@router.get("/forecast", deprecated=True)
def legacy_forecast(
    equipmentType: str = Query("Excavator"),
    horizonDays: int = Query(7, ge=1, le=28),
    _principal: Principal = Depends(get_demand_principal),
):
    try:
        return demand_service.legacy_forecast(equipmentType, horizonDays)
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.get("/projects")
def list_active_project_forecasts(
    principal: Principal = Depends(get_demand_principal),
):
    if principal.is_dealer or principal.role == ForecastRole.SYSTEM_ADMINISTRATOR:
        return demand_service.list_projects()
    return demand_service.list_projects(principal.company_id)


@router.get("/projects/{project_id}")
def project_forecast(
    project_id: int,
    response: Response,
    principal: Principal = Depends(get_demand_principal),
):
    _project_and_scope(project_id, principal)
    try:
        result = demand_service.project_forecast(project_id)
        response.headers["ETag"] = f'"{result["forecastRunId"]}-{project_id}"'
        response.headers["Cache-Control"] = "private, max-age=300"
        return result
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.get("/projects/{project_id}/equipment/{equipment_type}")
def project_equipment_forecast(
    project_id: int,
    equipment_type: str,
    response: Response,
    principal: Principal = Depends(get_demand_principal),
):
    _project_and_scope(project_id, principal)
    try:
        result = demand_service.equipment_forecast(project_id, equipment_type)
        response.headers["ETag"] = (
            f'"{result["forecastRunId"]}-{project_id}-{equipment_type}"'
        )
        response.headers["Cache-Control"] = "private, max-age=300"
        return result
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.get("/projects/{project_id}/packages")
def package_recommendations(
    project_id: int,
    equipmentType: str = Query(..., min_length=2, max_length=80),
    preference: str = Query("BALANCED"),
    principal: Principal = Depends(get_demand_principal),
):
    _project_and_scope(project_id, principal)
    try:
        return demand_service.package_recommendations(
            project_id, equipmentType, preference.upper()
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.get("/dealer")
def dealer_forecast(
    region: Optional[str] = Query(default=None),
    equipmentType: Optional[str] = Query(default=None),
    forecastWeek: Optional[str] = Query(default=None),
    confidence: Optional[str] = Query(default=None),
    principal: Principal = Depends(get_demand_principal),
):
    ensure_dealer_access(principal)
    return demand_service.dealer_view(region, equipmentType, forecastWeek, confidence)


@router.get("/metrics")
def model_metrics(principal: Principal = Depends(get_demand_principal)):
    if principal.role != ForecastRole.SYSTEM_ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="System administrator role required")
    return demand_service.metrics()


@router.get("/forecasts/{forecast_id}/explanation")
def forecast_explanation(
    forecast_id: int,
    principal: Principal = Depends(get_demand_principal),
):
    try:
        result = demand_service.explanation(forecast_id)
        project_id = forecast_id // 10000
        _project_and_scope(project_id, principal)
        return result
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.post("/override")
def override_forecast(
    body: ForecastOverrideIn,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    principal: Principal = Depends(get_demand_principal),
):
    if principal.role not in {
        ForecastRole.CUSTOMER_PROJECT_MANAGER,
        ForecastRole.SYSTEM_ADMINISTRATOR,
    }:
        raise HTTPException(status_code=403, detail="Project-manager role required")
    try:
        explanation = demand_service.explanation(body.forecastId)
        project_id = body.forecastId // 10000
        _project_and_scope(project_id, principal)
        return demand_service.override_forecast(
            body, principal, _idempotency(idempotency_key)
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.post("/feedback")
def recommendation_feedback(
    body: RecommendationFeedbackIn,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    principal: Principal = Depends(get_demand_principal),
):
    try:
        if body.forecastId:
            project_id = body.forecastId // 10000
            _project_and_scope(project_id, principal)
        return demand_service.record_feedback(
            body, principal, _idempotency(idempotency_key)
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.post("/manual-reviews", status_code=202)
def create_manual_review(
    body: ManualReviewIn,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    principal: Principal = Depends(get_demand_principal),
):
    try:
        project_id = body.forecastId // 10000
        _project_and_scope(project_id, principal)
        return demand_service.request_manual_review(
            body, principal, _idempotency(idempotency_key)
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.post("/dealer/actions/{action_id}/decision")
def decide_dealer_action(
    action_id: int,
    body: DealerActionDecisionIn,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    principal: Principal = Depends(get_demand_principal),
):
    ensure_dealer_access(principal)
    try:
        return demand_service.decide_dealer_action(
            action_id, body, principal, _idempotency(idempotency_key)
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc


@router.post("/dev/synthetic/generate")
def regenerate_synthetic(
    body: SyntheticGenerateIn,
    principal: Principal = Depends(get_demand_principal),
):
    if principal.role != ForecastRole.SYSTEM_ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="System administrator role required")
    return demand_service.regenerate_synthetic(body)


@router.post("/dev/models/retrain", status_code=201)
def retrain_demand_model(
    body: RetrainDemandModelIn,
    principal: Principal = Depends(get_demand_principal),
):
    if principal.role != ForecastRole.SYSTEM_ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="System administrator role required")
    try:
        return demand_service.retrain(body)
    except Exception as exc:  # noqa: BLE001
        raise _map_forecast_error(exc) from exc
