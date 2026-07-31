from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.domain import Company, Dealer, Equipment, ProjectSite
from app.models.enums import EquipmentStatus, ProjectSiteStatus
from app.models.forecasting import EquipmentAvailability, Project
from app.models.optimization import (
    EquipmentCostProfile,
    OptimizationCandidate,
    OptimizationRecommendation,
    PhaseEquipmentRequirement,
    ProjectPhase,
)
from app.schemas.optimization import OptimizationDecisionIn, OptimizationRunIn
from app.security.dashboard_access import (
    DashboardPrincipal,
    DashboardRole,
)
from app.services.fleet_optimization import FleetOptimizationService


@pytest.fixture()
def optimization_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session: Session = factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def optimization_scenario(optimization_db: Session):
    today = date.today()
    dealer = Dealer(dealer_name="Optimization Dealer")
    company = Company(company_name="Optimization Customer")
    optimization_db.add_all([dealer, company])
    optimization_db.flush()

    protected_source = ProjectSite(
        company_id=company.company_id,
        site_name="Protected Source",
        location="Bengaluru",
        latitude=Decimal("12.971599"),
        longitude=Decimal("77.594566"),
        status=ProjectSiteStatus.ACTIVE,
    )
    free_source = ProjectSite(
        company_id=company.company_id,
        site_name="Free Source",
        location="Mysuru",
        latitude=Decimal("12.295810"),
        longitude=Decimal("76.639381"),
        status=ProjectSiteStatus.ACTIVE,
    )
    destination = ProjectSite(
        company_id=company.company_id,
        site_name="Destination",
        location="Tumakuru",
        latitude=Decimal("13.339168"),
        longitude=Decimal("77.113998"),
        status=ProjectSiteStatus.ACTIVE,
    )
    optimization_db.add_all([protected_source, free_source, destination])
    optimization_db.flush()

    protected_project = Project(
        company_id=company.company_id,
        site_id=protected_source.site_id,
        project_code="SRC-001",
        project_name="Protected excavation",
        project_type="EARTHWORK",
        project_size=Decimal("100"),
        project_size_unit="ACRE",
        region="South",
        current_phase="EXCAVATION",
        phase_start_date=today,
        phase_end_date=today + timedelta(days=30),
        expected_project_end=today + timedelta(days=90),
        project_status="ACTIVE",
        priority="HIGH",
        progress_percentage=Decimal("20"),
    )
    destination_project = Project(
        company_id=company.company_id,
        site_id=destination.site_id,
        project_code="DST-001",
        project_name="Destination excavation",
        project_type="EARTHWORK",
        project_size=Decimal("80"),
        project_size_unit="ACRE",
        region="South",
        current_phase="EXCAVATION",
        phase_start_date=today + timedelta(days=10),
        phase_end_date=today + timedelta(days=20),
        expected_project_end=today + timedelta(days=75),
        project_status="ACTIVE",
        priority="STANDARD",
        progress_percentage=Decimal("5"),
    )
    optimization_db.add_all([protected_project, destination_project])
    optimization_db.flush()

    protected_phase = ProjectPhase(
        project_id=protected_project.project_id,
        phase_code="EXC",
        phase_name="Excavation",
        sequence=1,
        planned_start=today,
        planned_end=today + timedelta(days=30),
        status="IN_PROGRESS",
        progress_percentage=Decimal("20"),
        schedule_confidence="HIGH",
    )
    destination_phase = ProjectPhase(
        project_id=destination_project.project_id,
        phase_code="EXC",
        phase_name="Excavation",
        sequence=1,
        planned_start=today + timedelta(days=10),
        planned_end=today + timedelta(days=20),
        status="PLANNED",
        progress_percentage=Decimal("0"),
        schedule_confidence="HIGH",
    )
    optimization_db.add_all([protected_phase, destination_phase])
    optimization_db.flush()

    protected_requirement = PhaseEquipmentRequirement(
        phase_id=protected_phase.phase_id,
        equipment_type="Excavator",
        required_units=1,
        required_from=today,
        required_until=today + timedelta(days=20),
        criticality="HIGH",
        maximum_allowed_downtime_hours=4,
        substitution_allowed=False,
        source="PROJECT_PLAN",
    )
    destination_requirement = PhaseEquipmentRequirement(
        phase_id=destination_phase.phase_id,
        equipment_type="Excavator",
        required_units=2,
        required_from=today + timedelta(days=10),
        required_until=today + timedelta(days=20),
        criticality="STANDARD",
        maximum_allowed_downtime_hours=24,
        substitution_allowed=False,
        source="PROJECT_PLAN",
    )
    optimization_db.add_all([protected_requirement, destination_requirement])

    protected_machine = Equipment(
        dealer_id=dealer.dealer_id,
        equipment_name="Protected CAT 320",
        equipment_type="Excavator",
        status=EquipmentStatus.RENTED,
    )
    free_machine = Equipment(
        dealer_id=dealer.dealer_id,
        equipment_name="Free CAT 320",
        equipment_type="Excavator",
        status=EquipmentStatus.AVAILABLE,
    )
    optimization_db.add_all([protected_machine, free_machine])
    optimization_db.flush()

    optimization_db.add_all(
        [
            EquipmentAvailability(
                equipment_id=protected_machine.equipment_id,
                equipment_type="Excavator",
                equipment_model="320",
                current_region="South",
                current_site_id=protected_source.site_id,
                status="IN_USE",
                available_from=today,
            ),
            EquipmentAvailability(
                equipment_id=free_machine.equipment_id,
                equipment_type="Excavator",
                equipment_model="320",
                current_region="South",
                current_site_id=free_source.site_id,
                status="AVAILABLE",
                available_from=today,
            ),
            EquipmentCostProfile(
                equipment_type="Excavator",
                version=1,
                currency="INR",
                external_rental_daily_cost=Decimal("10000"),
                transfer_fixed_cost=Decimal("10000"),
                transfer_cost_per_km=Decimal("100"),
                idle_daily_cost=Decimal("1000"),
                shortage_penalty_daily=Decimal("5000"),
                effective_from=today - timedelta(days=1),
                active=True,
            ),
        ]
    )
    optimization_db.commit()
    return {
        "company_id": company.company_id,
        "protected_site_id": protected_source.site_id,
        "free_site_id": free_source.site_id,
        "destination_site_id": destination.site_id,
        "protected_equipment_id": protected_machine.equipment_id,
        "free_equipment_id": free_machine.equipment_id,
        "planning_start": today,
        "planning_end": today + timedelta(days=30),
    }


def _principal(company_id: int) -> DashboardPrincipal:
    return DashboardPrincipal(
        actor_id="optimizer-test",
        role=DashboardRole.FLEET_MANAGER,
        company_id=company_id,
        dealer_id=None,
    )


def test_optimizer_blocks_machine_needed_by_source_phase_and_chooses_safe_transfer(
    optimization_db: Session, optimization_scenario: dict
):
    result = FleetOptimizationService.run(
        optimization_db,
        OptimizationRunIn(
            planningStart=optimization_scenario["planning_start"],
            planningEnd=optimization_scenario["planning_end"],
        ),
        _principal(optimization_scenario["company_id"]),
    )

    candidates = result["candidates"]
    blocked = next(
        candidate
        for candidate in candidates
        if candidate["equipmentId"] == optimization_scenario["protected_equipment_id"]
    )
    assert blocked["feasible"] is False
    assert (
        "SOURCE_PROJECT_REQUIREMENT_WOULD_BE_UNDER_COVERED"
        in blocked["rejectionReasons"]
    )

    recommended = next(
        candidate for candidate in candidates if candidate["recommendationId"] is not None
    )
    assert recommended["action"] == "TRANSFER"
    assert recommended["equipmentId"] == optimization_scenario["free_equipment_id"]
    assert recommended["netSavings"] > 0
    selected_actions = [
        candidate["action"]
        for candidate in candidates
        if candidate["recommendationId"] is not None
    ]
    assert sorted(selected_actions) == ["RENT_EXTERNAL", "TRANSFER"]


def test_approval_is_idempotent_and_does_not_move_equipment(
    optimization_db: Session, optimization_scenario: dict
):
    result = FleetOptimizationService.run(
        optimization_db,
        OptimizationRunIn(
            planningStart=optimization_scenario["planning_start"],
            planningEnd=optimization_scenario["planning_end"],
        ),
        _principal(optimization_scenario["company_id"]),
    )
    recommended = next(
        candidate
        for candidate in result["candidates"]
        if candidate["recommendationId"] is not None
    )
    body = OptimizationDecisionIn(
        decision="APPROVED",
        expectedVersion=recommended["version"],
        reason="Verified source phase coverage and transfer timing.",
    )
    first = FleetOptimizationService.decide(
        optimization_db,
        recommended["recommendationId"],
        body,
        _principal(optimization_scenario["company_id"]),
        "optimizer-decision-test-0001",
    )
    second = FleetOptimizationService.decide(
        optimization_db,
        recommended["recommendationId"],
        body,
        _principal(optimization_scenario["company_id"]),
        "optimizer-decision-test-0001",
    )
    assert second == first
    assert first["executionStatus"] == "NOT_STARTED"

    availability = optimization_db.scalar(
        select(EquipmentAvailability).where(
            EquipmentAvailability.equipment_id
            == optimization_scenario["free_equipment_id"]
        )
    )
    assert availability.current_site_id == optimization_scenario["free_site_id"]

    recommendation = optimization_db.get(
        OptimizationRecommendation, recommended["recommendationId"]
    )
    assert recommendation.status == "APPROVED"


def test_optimizer_persists_rejected_alternatives_for_audit(
    optimization_db: Session, optimization_scenario: dict
):
    result = FleetOptimizationService.run(
        optimization_db,
        OptimizationRunIn(
            planningStart=optimization_scenario["planning_start"],
            planningEnd=optimization_scenario["planning_end"],
        ),
        _principal(optimization_scenario["company_id"]),
    )
    rows = optimization_db.scalars(
        select(OptimizationCandidate).where(
            OptimizationCandidate.optimization_run_id
            == result["run"]["optimizationRunId"]
        )
    ).all()
    assert any(not row.feasible for row in rows)
    assert any(row.action == "RENT_EXTERNAL" and row.feasible for row in rows)
