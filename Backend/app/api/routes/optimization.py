"""Project-phase planning and advisory fleet-optimization APIs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.optimization import (
    OptimizationDecisionIn,
    OptimizationRunIn,
    PhaseRequirementIn,
    ProjectPhaseIn,
)
from app.security.dashboard_access import DashboardPrincipal, get_dashboard_principal
from app.services.fleet_optimization import FleetOptimizationService

router = APIRouter(prefix="/api/v1", tags=["Fleet Optimization"])


def _map_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, PermissionError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, RuntimeError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, IntegrityError):
        return HTTPException(status_code=409, detail="Planning record conflicts with existing data")
    return HTTPException(status_code=500, detail="Fleet optimization failed")


@router.get("/projects/{project_id}/phases")
def list_project_phases(
    project_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    try:
        return FleetOptimizationService.list_phases(db, project_id, principal)
    except Exception as exc:  # noqa: BLE001
        raise _map_error(exc) from exc


@router.post("/projects/{project_id}/phases", status_code=201)
def create_project_phase(
    project_id: int,
    body: ProjectPhaseIn,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    try:
        return FleetOptimizationService.create_phase(db, project_id, body, principal)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise _map_error(exc) from exc


@router.post("/project-phases/{phase_id}/requirements", status_code=201)
def create_phase_requirement(
    phase_id: int,
    body: PhaseRequirementIn,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    try:
        return FleetOptimizationService.create_requirement(db, phase_id, body, principal)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise _map_error(exc) from exc


@router.post("/optimization/runs", status_code=201)
def run_optimization(
    body: OptimizationRunIn,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    try:
        return FleetOptimizationService.run(db, body, principal)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise _map_error(exc) from exc


@router.get("/optimization/runs/{run_id}")
def get_optimization_run(
    run_id: int,
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    try:
        return FleetOptimizationService.get_run(db, run_id, principal)
    except Exception as exc:  # noqa: BLE001
        raise _map_error(exc) from exc


@router.get("/optimization/recommendations")
def list_optimization_recommendations(
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    try:
        return FleetOptimizationService.list_recommendations(db, principal)
    except Exception as exc:  # noqa: BLE001
        raise _map_error(exc) from exc


@router.post("/optimization/recommendations/{recommendation_id}/decision")
def decide_optimization_recommendation(
    recommendation_id: int,
    body: OptimizationDecisionIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    try:
        if not idempotency_key or not 8 <= len(idempotency_key) <= 160:
            raise ValueError("Idempotency-Key header must contain 8-160 characters")
        return FleetOptimizationService.decide(
            db, recommendation_id, body, principal, idempotency_key
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise _map_error(exc) from exc
