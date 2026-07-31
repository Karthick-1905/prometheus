"""Deterministic, constraint-first fleet transfer optimizer.

The service is advisory. Approval records a decision but deliberately does not
mutate equipment assignments or availability.
"""
from __future__ import annotations

import hashlib
import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.domain import (
    Equipment,
    EquipmentAssignment,
    ProjectSite,
    RentalContract,
    UsageLog,
)
from app.models.forecasting import EquipmentAvailability, Project
from app.models.optimization import (
    EquipmentCapability,
    EquipmentCostProfile,
    EquipmentSubstitutionRule,
    OptimizationCandidate,
    OptimizationRecommendation,
    OptimizationRun,
    PhaseEquipmentRequirement,
    ProjectPhase,
)
from app.schemas.optimization import (
    OptimizationDecisionIn,
    OptimizationRunIn,
    PhaseRequirementIn,
    ProjectPhaseIn,
)
from app.security.dashboard_access import DashboardPrincipal, DashboardRole

OPTIMIZER_VERSION = "deterministic-transfer-v1"
TRANSFER_SPEED_KM_PER_DAY = 400


def _money(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _haversine_km(source: ProjectSite, destination: ProjectSite) -> Optional[float]:
    if (
        source.latitude is None
        or source.longitude is None
        or destination.latitude is None
        or destination.longitude is None
    ):
        return None
    lat1, lon1 = math.radians(float(source.latitude)), math.radians(float(source.longitude))
    lat2, lon2 = math.radians(float(destination.latitude)), math.radians(float(destination.longitude))
    d_lat = lat2 - lat1
    d_lon = lon2 - lon1
    value = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    return 6371.0088 * 2 * math.asin(math.sqrt(value))


def _site_json(site: Optional[ProjectSite]) -> Optional[dict[str, Any]]:
    if not site:
        return None
    return {
        "siteId": site.site_id,
        "siteName": site.site_name,
        "location": site.location,
    }


class FleetOptimizationService:
    @staticmethod
    def _project_for_scope(
        db: Session, project_id: int, principal: DashboardPrincipal
    ) -> Project:
        project = db.get(Project, project_id)
        if not project:
            raise LookupError("Project not found")
        if (
            principal.role != DashboardRole.SYSTEM_ADMINISTRATOR
            and not principal.is_dealer
            and project.company_id != principal.company_id
        ):
            raise PermissionError("Project is outside your company scope")
        if principal.is_dealer:
            serves_company = db.scalar(
                select(RentalContract.contract_id)
                .where(
                    RentalContract.company_id == project.company_id,
                    RentalContract.dealer_id == principal.dealer_id,
                )
                .limit(1)
            )
            if not serves_company:
                raise PermissionError("Project is outside your dealer scope")
        return project

    @staticmethod
    def list_phases(
        db: Session, project_id: int, principal: DashboardPrincipal
    ) -> dict[str, Any]:
        project = FleetOptimizationService._project_for_scope(db, project_id, principal)
        phases = db.scalars(
            select(ProjectPhase)
            .where(ProjectPhase.project_id == project.project_id)
            .order_by(ProjectPhase.sequence)
        ).all()
        requirements = db.scalars(
            select(PhaseEquipmentRequirement).where(
                PhaseEquipmentRequirement.phase_id.in_([phase.phase_id for phase in phases])
            )
        ).all() if phases else []
        grouped: dict[int, list[PhaseEquipmentRequirement]] = {}
        for requirement in requirements:
            grouped.setdefault(requirement.phase_id, []).append(requirement)
        return {
            "success": True,
            "projectId": project.project_id,
            "phases": [
                FleetOptimizationService._phase_json(phase, grouped.get(phase.phase_id, []))
                for phase in phases
            ],
        }

    @staticmethod
    def create_phase(
        db: Session,
        project_id: int,
        body: ProjectPhaseIn,
        principal: DashboardPrincipal,
    ) -> dict[str, Any]:
        FleetOptimizationService._require_plan_editor(principal)
        project = FleetOptimizationService._project_for_scope(db, project_id, principal)
        phase = ProjectPhase(
            project_id=project.project_id,
            phase_code=body.phaseCode.strip(),
            phase_name=body.phaseName.strip(),
            sequence=body.sequence,
            planned_start=body.plannedStart,
            planned_end=body.plannedEnd,
            status=body.status,
            progress_percentage=_money(body.progressPercentage),
            schedule_confidence=body.scheduleConfidence,
            version=1,
        )
        db.add(phase)
        db.commit()
        db.refresh(phase)
        return {"success": True, "phase": FleetOptimizationService._phase_json(phase, [])}

    @staticmethod
    def create_requirement(
        db: Session,
        phase_id: int,
        body: PhaseRequirementIn,
        principal: DashboardPrincipal,
    ) -> dict[str, Any]:
        FleetOptimizationService._require_plan_editor(principal)
        phase = db.get(ProjectPhase, phase_id)
        if not phase:
            raise LookupError("Project phase not found")
        FleetOptimizationService._project_for_scope(db, phase.project_id, principal)
        if body.requiredFrom < phase.plannedStart or body.requiredUntil > phase.plannedEnd:
            raise ValueError("Requirement dates must remain inside the phase dates")
        requirement = PhaseEquipmentRequirement(
            phase_id=phase.phase_id,
            equipment_type=body.equipmentType.strip(),
            required_capability=body.requiredCapability,
            minimum_capacity=_money(body.minimumCapacity) if body.minimumCapacity is not None else None,
            required_units=body.requiredUnits,
            planned_machine_hours=_money(body.plannedMachineHours) if body.plannedMachineHours is not None else None,
            required_from=body.requiredFrom,
            required_until=body.requiredUntil,
            criticality=body.criticality,
            maximum_allowed_downtime_hours=body.maximumAllowedDowntimeHours,
            substitution_allowed=body.substitutionAllowed,
            source=body.source,
            version=1,
        )
        db.add(requirement)
        db.commit()
        db.refresh(requirement)
        return {
            "success": True,
            "requirement": FleetOptimizationService._requirement_json(requirement),
        }

    @staticmethod
    def run(
        db: Session, body: OptimizationRunIn, principal: DashboardPrincipal
    ) -> dict[str, Any]:
        FleetOptimizationService._require_optimizer(principal)
        now = datetime.now(timezone.utc)
        watermark = hashlib.sha256(
            f"{now.isoformat()}:{body.planningStart}:{body.planningEnd}".encode()
        ).hexdigest()[:20]
        run = OptimizationRun(
            company_id=None if principal.is_dealer else principal.company_id,
            dealer_id=principal.dealer_id if principal.is_dealer else None,
            planning_start=body.planningStart,
            planning_end=body.planningEnd,
            as_of=now,
            optimizer_version=OPTIMIZER_VERSION,
            input_watermark=watermark,
            status="RUNNING",
            warnings=[],
            created_by=principal.actor_id,
        )
        db.add(run)
        db.flush()

        requirements = FleetOptimizationService._requirements_in_scope(
            db, body, principal
        )
        warnings: list[str] = []
        selected_equipment_ids: set[int] = set()
        selected_source_counts: dict[tuple[int, str], int] = {}
        for requirement, phase, project, destination in requirements:
            FleetOptimizationService._evaluate_requirement(
                db,
                run,
                requirement,
                phase,
                project,
                destination,
                body,
                principal,
                warnings,
                selected_equipment_ids,
                selected_source_counts,
            )
        run.status = "COMPLETED"
        run.warnings = sorted(set(warnings))
        db.commit()
        return FleetOptimizationService.get_run(db, run.optimization_run_id, principal)

    @staticmethod
    def get_run(
        db: Session, run_id: int, principal: DashboardPrincipal
    ) -> dict[str, Any]:
        run = db.get(OptimizationRun, run_id)
        if not run:
            raise LookupError("Optimization run not found")
        FleetOptimizationService._ensure_run_scope(run, principal)
        candidates = db.scalars(
            select(OptimizationCandidate)
            .where(OptimizationCandidate.optimization_run_id == run_id)
            .order_by(OptimizationCandidate.optimization_score, OptimizationCandidate.candidate_id)
        ).all()
        recommendations = db.scalars(
            select(OptimizationRecommendation).where(
                OptimizationRecommendation.optimization_run_id == run_id
            )
        ).all()
        recommendation_by_candidate = {
            item.candidate_id: item for item in recommendations
        }
        site_ids = {
            value
            for candidate in candidates
            for value in (candidate.source_site_id, candidate.destination_site_id)
            if value is not None
        }
        sites = {
            site.site_id: site
            for site in db.scalars(select(ProjectSite).where(ProjectSite.site_id.in_(site_ids))).all()
        } if site_ids else {}
        return {
            "success": True,
            "run": {
                "optimizationRunId": run.optimization_run_id,
                "planningStart": run.planning_start.isoformat(),
                "planningEnd": run.planning_end.isoformat(),
                "asOf": run.as_of.isoformat(),
                "optimizerVersion": run.optimizer_version,
                "status": run.status,
                "warnings": run.warnings,
            },
            "candidates": [
                FleetOptimizationService._candidate_json(
                    candidate,
                    recommendation_by_candidate.get(candidate.candidate_id),
                    sites,
                )
                for candidate in candidates
            ],
        }

    @staticmethod
    def list_recommendations(
        db: Session, principal: DashboardPrincipal
    ) -> dict[str, Any]:
        FleetOptimizationService._require_optimizer(principal)
        statement = (
            select(OptimizationRecommendation, OptimizationCandidate, OptimizationRun)
            .join(
                OptimizationCandidate,
                OptimizationCandidate.candidate_id
                == OptimizationRecommendation.candidate_id,
            )
            .join(
                OptimizationRun,
                OptimizationRun.optimization_run_id
                == OptimizationRecommendation.optimization_run_id,
            )
        )
        if principal.is_dealer:
            statement = statement.where(OptimizationRun.dealer_id == principal.dealer_id)
        elif principal.role != DashboardRole.SYSTEM_ADMINISTRATOR:
            statement = statement.where(OptimizationRun.company_id == principal.company_id)
        rows = db.execute(
            statement.order_by(OptimizationRecommendation.created_at.desc()).limit(100)
        ).all()
        site_ids = {
            value
            for _, candidate, _ in rows
            for value in (candidate.source_site_id, candidate.destination_site_id)
            if value is not None
        }
        sites = {
            site.site_id: site
            for site in db.scalars(select(ProjectSite).where(ProjectSite.site_id.in_(site_ids))).all()
        } if site_ids else {}
        return {
            "success": True,
            "recommendations": [
                FleetOptimizationService._candidate_json(candidate, recommendation, sites)
                for recommendation, candidate, _ in rows
            ],
        }

    @staticmethod
    def decide(
        db: Session,
        recommendation_id: int,
        body: OptimizationDecisionIn,
        principal: DashboardPrincipal,
        idempotency_key: str,
    ) -> dict[str, Any]:
        FleetOptimizationService._require_optimizer(principal)
        recommendation = db.get(OptimizationRecommendation, recommendation_id)
        if not recommendation:
            raise LookupError("Optimization recommendation not found")
        run = db.get(OptimizationRun, recommendation.optimization_run_id)
        FleetOptimizationService._ensure_run_scope(run, principal)
        if recommendation.decision_idempotency_key == idempotency_key:
            return {
                "success": True,
                "recommendationId": recommendation.recommendation_id,
                "status": recommendation.status,
                "version": recommendation.version,
                "executionStatus": "NOT_STARTED",
                "message": "Decision recorded. Equipment assignments were not changed.",
            }
        duplicate = db.scalar(
            select(OptimizationRecommendation).where(
                OptimizationRecommendation.decision_idempotency_key
                == idempotency_key
            )
        )
        if duplicate:
            raise RuntimeError(
                "Idempotency key was already used for another recommendation"
            )
        if recommendation.version != body.expectedVersion:
            raise RuntimeError("Recommendation changed; refresh before deciding")
        if recommendation.status != "PROPOSED":
            raise RuntimeError("Recommendation has already been decided")
        recommendation.status = body.decision
        recommendation.decision_reason = body.reason.strip()
        recommendation.decision_idempotency_key = idempotency_key
        recommendation.decided_by = principal.actor_id
        recommendation.decided_at = datetime.now(timezone.utc)
        recommendation.version += 1
        db.commit()
        return {
            "success": True,
            "recommendationId": recommendation.recommendation_id,
            "status": recommendation.status,
            "version": recommendation.version,
            "executionStatus": "NOT_STARTED",
            "message": "Decision recorded. Equipment assignments were not changed.",
        }

    @staticmethod
    def _evaluate_requirement(
        db: Session,
        run: OptimizationRun,
        requirement: PhaseEquipmentRequirement,
        phase: ProjectPhase,
        _project: Project,
        destination: ProjectSite,
        body: OptimizationRunIn,
        principal: DashboardPrincipal,
        warnings: list[str],
        selected_equipment_ids: set[int],
        selected_source_counts: dict[tuple[int, str], int],
    ) -> None:
        compatible_types = {requirement.equipment_type}
        substitution_rules: dict[str, EquipmentSubstitutionRule] = {}
        if requirement.substitution_allowed:
            substitutes = db.scalars(
                select(EquipmentSubstitutionRule).where(
                    EquipmentSubstitutionRule.required_equipment_type
                    == requirement.equipment_type,
                    EquipmentSubstitutionRule.active.is_(True),
                )
            ).all()
            compatible_types.update(rule.substitute_equipment_type for rule in substitutes)
            substitution_rules = {
                rule.substitute_equipment_type: rule for rule in substitutes
            }

        destination_units = FleetOptimizationService._site_inventory_count(
            db,
            destination.site_id,
            compatible_types,
            requirement.required_from,
            principal,
        )
        deficit = max(0, requirement.required_units - destination_units)
        if deficit == 0:
            return

        cost_profile = db.scalar(
            select(EquipmentCostProfile)
            .where(
                EquipmentCostProfile.equipment_type == requirement.equipment_type,
                EquipmentCostProfile.active.is_(True),
                EquipmentCostProfile.effective_from <= requirement.required_from,
                or_(
                    EquipmentCostProfile.effective_to.is_(None),
                    EquipmentCostProfile.effective_to >= requirement.required_until,
                ),
            )
            .order_by(EquipmentCostProfile.version.desc())
        )
        duration_days = (requirement.required_until - requirement.required_from).days + 1
        if not cost_profile:
            warnings.append(
                f"Missing active cost profile for {requirement.equipment_type}; "
                f"requirement {requirement.requirement_id} needs manual review."
            )
            FleetOptimizationService._persist_candidate(
                db,
                run,
                action="MANUAL_REVIEW",
                equipment_id=None,
                equipment_type=requirement.equipment_type,
                source_site_id=None,
                destination_site_id=destination.site_id,
                requirement_id=requirement.requirement_id,
                feasible=False,
                reasons=["MISSING_COST_PROFILE"],
                explanation="Cost comparison cannot be performed without an active cost profile.",
            )
            return

        baseline_cost = _money(cost_profile.external_rental_daily_cost * duration_days)
        rental_candidates = [
            FleetOptimizationService._persist_candidate(
                db,
                run,
                action="RENT_EXTERNAL",
                equipment_id=None,
                equipment_type=requirement.equipment_type,
                source_site_id=None,
                destination_site_id=destination.site_id,
                requirement_id=requirement.requirement_id,
                feasible=True,
                baseline_cost=baseline_cost,
                candidate_cost=baseline_cost,
                net_savings=Decimal("0"),
                risk_penalty=Decimal("0"),
                score=baseline_cost,
                breakdown={
                    "currency": cost_profile.currency,
                    "externalRental": float(baseline_cost),
                    "durationDays": duration_days,
                },
                explanation=(
                    f"Rent one {requirement.equipment_type} externally for "
                    f"{duration_days} days to cover the phase requirement."
                ),
            )
            for _ in range(deficit)
        ]

        inventory_statement = select(EquipmentAvailability, Equipment).join(
            Equipment, Equipment.equipment_id == EquipmentAvailability.equipment_id
        ).where(
            EquipmentAvailability.current_site_id.is_not(None),
            EquipmentAvailability.current_site_id != destination.site_id,
            EquipmentAvailability.equipment_type.in_(compatible_types),
            EquipmentAvailability.status.not_in(["RESERVED", "UNAVAILABLE", "MAINTENANCE"]),
            EquipmentAvailability.available_from <= requirement.required_from,
        )
        if principal.is_dealer:
            inventory_statement = inventory_statement.where(
                Equipment.dealer_id == principal.dealer_id
            )
        elif principal.role != DashboardRole.SYSTEM_ADMINISTRATOR:
            inventory_statement = inventory_statement.where(
                EquipmentAvailability.current_site_id.in_(
                    select(ProjectSite.site_id).where(
                        ProjectSite.company_id == principal.company_id
                    )
                )
            )
        source_rows = db.execute(inventory_statement).all()
        feasible_transfers: list[OptimizationCandidate] = []
        for availability, equipment in source_rows:
            source = db.get(ProjectSite, availability.current_site_id)
            reasons: list[str] = []
            if equipment.equipment_id in selected_equipment_ids:
                reasons.append("EQUIPMENT_ALREADY_SELECTED_IN_THIS_RUN")
            if not source:
                reasons.append("SOURCE_SITE_NOT_FOUND")
            distance = _haversine_km(source, destination) if source else None
            if distance is None:
                reasons.append("SITE_COORDINATES_MISSING")
            lead_days = math.ceil((distance or 0) / TRANSFER_SPEED_KM_PER_DAY) + 1
            if (
                body.planningStart.toordinal() + lead_days
                > requirement.required_from.toordinal()
            ):
                reasons.append("TRANSFER_CANNOT_ARRIVE_BEFORE_REQUIRED_DATE")
            reasons.extend(
                FleetOptimizationService._source_coverage_reasons(
                    db,
                    source.site_id if source else None,
                    availability.equipment_type,
                    requirement.required_from,
                    requirement.required_until,
                    principal,
                    selected_source_counts.get(
                        (source.site_id, availability.equipment_type), 0
                    )
                    if source
                    else 0,
                )
            )
            reasons.extend(
                FleetOptimizationService._capability_reasons(
                    db, availability.equipment_type, requirement
                )
            )
            substitution_rule = substitution_rules.get(availability.equipment_type)
            if availability.equipment_type != requirement.equipment_type:
                if not substitution_rule:
                    reasons.append("SUBSTITUTION_RULE_NOT_FOUND")
                elif substitution_rule.productivity_ratio < Decimal("1"):
                    reasons.append("SUBSTITUTE_PRODUCTIVITY_BELOW_REQUIRED_UNIT")
                elif substitution_rule.restrictions:
                    reasons.append("SUBSTITUTION_RESTRICTIONS_REQUIRE_MANUAL_REVIEW")
            transfer_cost = (
                _money(
                    cost_profile.transfer_fixed_cost
                    + cost_profile.transfer_cost_per_km * Decimal(str(distance or 0))
                )
                if distance is not None
                else None
            )
            substitution_penalty = _money(
                baseline_cost
                * (
                    substitution_rule.cost_penalty_percentage
                    if substitution_rule
                    else Decimal("0")
                )
            )
            recent_utilization = FleetOptimizationService._recent_utilization(
                db, equipment.equipment_id
            )
            utilization_penalty = _money(
                baseline_cost * Decimal(str(recent_utilization or 0)) * Decimal("0.15")
            )
            risk_factor = {
                "HIGH": Decimal("0.05"),
                "MODERATE": Decimal("0.12"),
                "LOW": Decimal("0.25"),
            }.get(phase.schedule_confidence, Decimal("0.15"))
            criticality_factor = {
                "STANDARD": Decimal("1"),
                "HIGH": Decimal("1.5"),
                "CRITICAL": Decimal("2"),
            }[requirement.criticality]
            risk_penalty = _money(
                cost_profile.shortage_penalty_daily
                * duration_days
                * risk_factor
                * criticality_factor
            )
            candidate_cost = (
                _money(
                    (transfer_cost or Decimal("0"))
                    + risk_penalty
                    + substitution_penalty
                    + utilization_penalty
                )
                if transfer_cost is not None
                else None
            )
            net_savings = (
                _money(baseline_cost - candidate_cost)
                if candidate_cost is not None
                else None
            )
            if net_savings is not None and net_savings <= 0:
                reasons.append("TRANSFER_COST_NOT_LOWER_THAN_EXTERNAL_RENTAL")
            feasible = not reasons
            candidate = FleetOptimizationService._persist_candidate(
                db,
                run,
                action=(
                    "TRANSFER"
                    if availability.equipment_type == requirement.equipment_type
                    else "TRANSFER_SUBSTITUTE"
                ),
                equipment_id=equipment.equipment_id,
                equipment_type=availability.equipment_type,
                source_site_id=source.site_id if source else None,
                destination_site_id=destination.site_id,
                requirement_id=requirement.requirement_id,
                feasible=feasible,
                reasons=reasons,
                distance=distance,
                lead_days=lead_days,
                baseline_cost=baseline_cost,
                candidate_cost=candidate_cost,
                net_savings=net_savings,
                risk_penalty=risk_penalty,
                score=candidate_cost,
                breakdown={
                    "currency": cost_profile.currency,
                    "externalRentalBaseline": float(baseline_cost),
                    "transfer": float(transfer_cost) if transfer_cost is not None else None,
                    "riskPenalty": float(risk_penalty),
                    "substitutionPenalty": float(substitution_penalty),
                    "recentUtilization": recent_utilization,
                    "utilizationOpportunityPenalty": float(utilization_penalty),
                    "durationDays": duration_days,
                },
                explanation=(
                    f"Transfer {equipment.equipment_name or availability.equipment_type} "
                    f"from {source.site_name if source else 'an unknown source'} to "
                    f"{destination.site_name}. Source phase coverage and arrival timing "
                    f"were checked before costing."
                ),
            )
            if feasible:
                feasible_transfers.append(candidate)

        ranked = sorted(
            [*rental_candidates, *feasible_transfers],
            key=lambda candidate: candidate.optimization_score
            if candidate.optimization_score is not None
            else Decimal("999999999"),
        )
        selected: list[OptimizationCandidate] = []
        for candidate in ranked:
            if len(selected) >= deficit:
                break
            if (
                candidate.equipment_id is not None
                and candidate.equipment_id in selected_equipment_ids
            ):
                candidate.feasible = False
                candidate.rejection_reasons = [
                    *candidate.rejection_reasons,
                    "EQUIPMENT_ALREADY_SELECTED_IN_THIS_RUN",
                ]
                continue
            if candidate.source_site_id is not None:
                allocation_reasons = FleetOptimizationService._source_coverage_reasons(
                    db,
                    candidate.source_site_id,
                    candidate.equipment_type,
                    requirement.required_from,
                    requirement.required_until,
                    principal,
                    selected_source_counts.get(
                        (candidate.source_site_id, candidate.equipment_type), 0
                    ),
                )
                if allocation_reasons:
                    candidate.feasible = False
                    candidate.rejection_reasons = sorted(
                        set([*candidate.rejection_reasons, *allocation_reasons])
                    )
                    continue
            selected.append(candidate)
            if candidate.equipment_id is not None:
                selected_equipment_ids.add(candidate.equipment_id)
            if candidate.source_site_id is not None:
                key = (candidate.source_site_id, candidate.equipment_type)
                selected_source_counts[key] = selected_source_counts.get(key, 0) + 1
        for best in selected:
            recommendation = OptimizationRecommendation(
                optimization_run_id=run.optimization_run_id,
                candidate_id=best.candidate_id,
                status="PROPOSED",
                version=1,
            )
            db.add(recommendation)

    @staticmethod
    def _source_coverage_reasons(
        db: Session,
        source_site_id: Optional[int],
        equipment_type: str,
        required_from: date,
        required_until: date,
        principal: DashboardPrincipal,
        already_selected_from_source: int,
    ) -> list[str]:
        if source_site_id is None:
            return ["SOURCE_SITE_NOT_FOUND"]
        source_inventory = FleetOptimizationService._site_inventory_count(
            db, source_site_id, {equipment_type}, required_from, principal
        )
        protected_units = db.scalar(
            select(func.coalesce(func.sum(PhaseEquipmentRequirement.required_units), 0))
            .join(
                ProjectPhase,
                ProjectPhase.phase_id == PhaseEquipmentRequirement.phase_id,
            )
            .join(Project, Project.project_id == ProjectPhase.project_id)
            .where(
                Project.site_id == source_site_id,
                PhaseEquipmentRequirement.equipment_type == equipment_type,
                PhaseEquipmentRequirement.required_from <= required_until,
                PhaseEquipmentRequirement.required_until >= required_from,
                ProjectPhase.status.in_(["PLANNED", "IN_PROGRESS"]),
            )
        ) or 0
        if (
            source_inventory - already_selected_from_source - 1
            < int(protected_units)
        ):
            return ["SOURCE_PROJECT_REQUIREMENT_WOULD_BE_UNDER_COVERED"]
        return []

    @staticmethod
    def _capability_reasons(
        db: Session,
        equipment_type: str,
        requirement: PhaseEquipmentRequirement,
    ) -> list[str]:
        if not requirement.required_capability:
            return []
        capability = db.scalar(
            select(EquipmentCapability).where(
                EquipmentCapability.equipment_type == equipment_type,
                EquipmentCapability.capability_code == requirement.required_capability,
                EquipmentCapability.active.is_(True),
            )
        )
        if not capability:
            return ["REQUIRED_CAPABILITY_NOT_PROVEN"]
        if (
            requirement.minimum_capacity is not None
            and (
                capability.capacity_value is None
                or capability.capacity_value < requirement.minimum_capacity
            )
        ):
            return ["MINIMUM_CAPACITY_NOT_MET"]
        return []

    @staticmethod
    def _site_inventory_count(
        db: Session,
        site_id: int,
        equipment_types: set[str],
        available_by: date,
        principal: DashboardPrincipal,
    ) -> int:
        statement = (
            select(func.count(EquipmentAvailability.availability_id))
            .join(Equipment, Equipment.equipment_id == EquipmentAvailability.equipment_id)
            .where(
                EquipmentAvailability.current_site_id == site_id,
                EquipmentAvailability.equipment_type.in_(equipment_types),
                EquipmentAvailability.status.not_in(
                    ["RESERVED", "UNAVAILABLE", "MAINTENANCE"]
                ),
                EquipmentAvailability.available_from <= available_by,
            )
        )
        if principal.is_dealer:
            statement = statement.where(Equipment.dealer_id == principal.dealer_id)
        elif principal.role != DashboardRole.SYSTEM_ADMINISTRATOR:
            statement = statement.where(
                EquipmentAvailability.current_site_id.in_(
                    select(ProjectSite.site_id).where(
                        ProjectSite.company_id == principal.company_id
                    )
                )
            )
        return int(db.scalar(statement) or 0)

    @staticmethod
    def _recent_utilization(db: Session, equipment_id: int) -> Optional[float]:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        totals = db.execute(
            select(
                func.coalesce(func.sum(UsageLog.runtime_hours), 0),
                func.coalesce(func.sum(UsageLog.idle_hours), 0),
            )
            .join(
                EquipmentAssignment,
                EquipmentAssignment.assignment_id == UsageLog.assignment_id,
            )
            .join(
                RentalContract,
                RentalContract.contract_id == EquipmentAssignment.contract_id,
            )
            .where(
                RentalContract.equipment_id == equipment_id,
                UsageLog.recorded_at >= since,
            )
        ).one()
        runtime, idle = float(totals[0]), float(totals[1])
        return round(runtime / (runtime + idle), 4) if runtime + idle else None

    @staticmethod
    def _requirements_in_scope(
        db: Session, body: OptimizationRunIn, principal: DashboardPrincipal
    ) -> list[tuple[Any, ...]]:
        statement = (
            select(PhaseEquipmentRequirement, ProjectPhase, Project, ProjectSite)
            .join(ProjectPhase, ProjectPhase.phase_id == PhaseEquipmentRequirement.phase_id)
            .join(Project, Project.project_id == ProjectPhase.project_id)
            .join(ProjectSite, ProjectSite.site_id == Project.site_id)
            .where(
                Project.project_status == "ACTIVE",
                ProjectPhase.status.in_(["PLANNED", "IN_PROGRESS"]),
                PhaseEquipmentRequirement.required_from <= body.planningEnd,
                PhaseEquipmentRequirement.required_until >= body.planningStart,
            )
        )
        if principal.role != DashboardRole.SYSTEM_ADMINISTRATOR and not principal.is_dealer:
            statement = statement.where(Project.company_id == principal.company_id)
        elif principal.is_dealer:
            statement = statement.where(
                Project.company_id.in_(
                    select(RentalContract.company_id)
                    .where(RentalContract.dealer_id == principal.dealer_id)
                    .distinct()
                )
            )
        return list(db.execute(statement).all())

    @staticmethod
    def _persist_candidate(
        db: Session,
        run: OptimizationRun,
        *,
        action: str,
        equipment_id: Optional[int],
        equipment_type: str,
        source_site_id: Optional[int],
        destination_site_id: Optional[int],
        requirement_id: Optional[int],
        feasible: bool,
        explanation: str,
        reasons: Optional[list[str]] = None,
        distance: Optional[float] = None,
        lead_days: Optional[int] = None,
        baseline_cost: Optional[Decimal] = None,
        candidate_cost: Optional[Decimal] = None,
        net_savings: Optional[Decimal] = None,
        risk_penalty: Optional[Decimal] = None,
        score: Optional[Decimal] = None,
        breakdown: Optional[dict[str, Any]] = None,
    ) -> OptimizationCandidate:
        candidate = OptimizationCandidate(
            optimization_run_id=run.optimization_run_id,
            action=action,
            recommended_units=1,
            equipment_id=equipment_id,
            equipment_type=equipment_type,
            source_site_id=source_site_id,
            destination_site_id=destination_site_id,
            requirement_id=requirement_id,
            feasible=feasible,
            rejection_reasons=reasons or [],
            distance_km=_money(distance) if distance is not None else None,
            transfer_lead_days=lead_days,
            baseline_cost=baseline_cost,
            candidate_cost=candidate_cost,
            net_savings=net_savings,
            risk_penalty=risk_penalty,
            optimization_score=score,
            cost_breakdown=breakdown or {},
            explanation=explanation,
        )
        db.add(candidate)
        db.flush()
        return candidate

    @staticmethod
    def _phase_json(
        phase: ProjectPhase, requirements: list[PhaseEquipmentRequirement]
    ) -> dict[str, Any]:
        return {
            "phaseId": phase.phase_id,
            "projectId": phase.project_id,
            "phaseCode": phase.phase_code,
            "phaseName": phase.phase_name,
            "sequence": phase.sequence,
            "plannedStart": phase.planned_start.isoformat(),
            "plannedEnd": phase.planned_end.isoformat(),
            "status": phase.status,
            "progressPercentage": float(phase.progress_percentage),
            "scheduleConfidence": phase.schedule_confidence,
            "version": phase.version,
            "requirements": [
                FleetOptimizationService._requirement_json(item)
                for item in requirements
            ],
        }

    @staticmethod
    def _requirement_json(
        requirement: PhaseEquipmentRequirement,
    ) -> dict[str, Any]:
        return {
            "requirementId": requirement.requirement_id,
            "phaseId": requirement.phase_id,
            "equipmentType": requirement.equipment_type,
            "requiredCapability": requirement.required_capability,
            "minimumCapacity": (
                float(requirement.minimum_capacity)
                if requirement.minimum_capacity is not None
                else None
            ),
            "requiredUnits": requirement.required_units,
            "plannedMachineHours": (
                float(requirement.planned_machine_hours)
                if requirement.planned_machine_hours is not None
                else None
            ),
            "requiredFrom": requirement.required_from.isoformat(),
            "requiredUntil": requirement.required_until.isoformat(),
            "criticality": requirement.criticality,
            "maximumAllowedDowntimeHours": requirement.maximum_allowed_downtime_hours,
            "substitutionAllowed": requirement.substitution_allowed,
            "source": requirement.source,
            "version": requirement.version,
        }

    @staticmethod
    def _candidate_json(
        candidate: OptimizationCandidate,
        recommendation: Optional[OptimizationRecommendation],
        sites: dict[int, ProjectSite],
    ) -> dict[str, Any]:
        return {
            "candidateId": candidate.candidate_id,
            "recommendationId": (
                recommendation.recommendation_id if recommendation else None
            ),
            "recommendationStatus": recommendation.status if recommendation else None,
            "version": recommendation.version if recommendation else None,
            "action": candidate.action,
            "recommendedUnits": candidate.recommended_units,
            "equipmentId": candidate.equipment_id,
            "equipmentType": candidate.equipment_type,
            "sourceSite": _site_json(sites.get(candidate.source_site_id)),
            "destinationSite": _site_json(sites.get(candidate.destination_site_id)),
            "requirementId": candidate.requirement_id,
            "feasible": candidate.feasible,
            "rejectionReasons": candidate.rejection_reasons,
            "distanceKm": (
                float(candidate.distance_km)
                if candidate.distance_km is not None
                else None
            ),
            "transferLeadDays": candidate.transfer_lead_days,
            "baselineCost": (
                float(candidate.baseline_cost)
                if candidate.baseline_cost is not None
                else None
            ),
            "candidateCost": (
                float(candidate.candidate_cost)
                if candidate.candidate_cost is not None
                else None
            ),
            "netSavings": (
                float(candidate.net_savings)
                if candidate.net_savings is not None
                else None
            ),
            "riskPenalty": (
                float(candidate.risk_penalty)
                if candidate.risk_penalty is not None
                else None
            ),
            "optimizationScore": (
                float(candidate.optimization_score)
                if candidate.optimization_score is not None
                else None
            ),
            "costBreakdown": candidate.cost_breakdown,
            "explanation": candidate.explanation,
        }

    @staticmethod
    def _require_plan_editor(principal: DashboardPrincipal) -> None:
        if principal.role not in {
            DashboardRole.FLEET_MANAGER,
            DashboardRole.SITE_MANAGER,
            DashboardRole.SITE_ENGINEER,
            DashboardRole.SYSTEM_ADMINISTRATOR,
        }:
            raise PermissionError("Project planning role required")

    @staticmethod
    def _require_optimizer(principal: DashboardPrincipal) -> None:
        if principal.role not in {
            DashboardRole.FLEET_MANAGER,
            DashboardRole.DEALER,
            DashboardRole.DEALER_MANAGER,
            DashboardRole.SYSTEM_ADMINISTRATOR,
        }:
            raise PermissionError("Fleet, dealer, or administrator role required")

    @staticmethod
    def _ensure_run_scope(
        run: OptimizationRun, principal: DashboardPrincipal
    ) -> None:
        if principal.role == DashboardRole.SYSTEM_ADMINISTRATOR:
            return
        if principal.is_dealer and run.dealer_id == principal.dealer_id:
            return
        if not principal.is_dealer and run.company_id == principal.company_id:
            return
        raise PermissionError("Optimization run is outside your scope")
