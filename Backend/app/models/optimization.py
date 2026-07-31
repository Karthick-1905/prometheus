"""Project-phase requirements and auditable fleet-optimization records."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectPhase(Base):
    __tablename__ = "ProjectPhase"
    __table_args__ = (
        UniqueConstraint("project_id", "sequence", name="uq_project_phase_sequence"),
        Index("ix_project_phase_status_dates", "status", "planned_start", "planned_end"),
    )

    phase_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("Project.project_id", ondelete="CASCADE")
    )
    phase_code: Mapped[str] = mapped_column(String(50))
    phase_name: Mapped[str] = mapped_column(String(120))
    sequence: Mapped[int] = mapped_column(Integer)
    planned_start: Mapped[date] = mapped_column(Date)
    planned_end: Mapped[date] = mapped_column(Date)
    actual_start: Mapped[Optional[date]] = mapped_column(Date)
    actual_end: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(24))
    progress_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    schedule_confidence: Mapped[str] = mapped_column(String(20), default="MODERATE")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PhaseEquipmentRequirement(Base):
    __tablename__ = "PhaseEquipmentRequirement"
    __table_args__ = (
        Index(
            "ix_phase_requirement_type_dates",
            "equipment_type",
            "required_from",
            "required_until",
        ),
    )

    requirement_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    phase_id: Mapped[int] = mapped_column(
        ForeignKey("ProjectPhase.phase_id", ondelete="CASCADE")
    )
    equipment_type: Mapped[str] = mapped_column(String(80))
    required_capability: Mapped[Optional[str]] = mapped_column(String(80))
    minimum_capacity: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    required_units: Mapped[int] = mapped_column(Integer)
    planned_machine_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    required_from: Mapped[date] = mapped_column(Date)
    required_until: Mapped[date] = mapped_column(Date)
    criticality: Mapped[str] = mapped_column(String(20), default="STANDARD")
    maximum_allowed_downtime_hours: Mapped[int] = mapped_column(Integer, default=24)
    substitution_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(30), default="PROJECT_PLAN")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class EquipmentCapability(Base):
    __tablename__ = "EquipmentCapability"
    __table_args__ = (
        UniqueConstraint(
            "equipment_type", "capability_code", name="uq_equipment_type_capability"
        ),
    )

    capability_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    equipment_type: Mapped[str] = mapped_column(String(80))
    capability_code: Mapped[str] = mapped_column(String(80))
    capacity_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    capacity_unit: Mapped[Optional[str]] = mapped_column(String(30))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class EquipmentSubstitutionRule(Base):
    __tablename__ = "EquipmentSubstitutionRule"
    __table_args__ = (
        UniqueConstraint(
            "required_equipment_type",
            "substitute_equipment_type",
            name="uq_equipment_substitution_pair",
        ),
    )

    substitution_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    required_equipment_type: Mapped[str] = mapped_column(String(80))
    substitute_equipment_type: Mapped[str] = mapped_column(String(80))
    productivity_ratio: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=1)
    cost_penalty_percentage: Mapped[Decimal] = mapped_column(
        Numeric(6, 4), default=0
    )
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    restrictions: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class EquipmentCostProfile(Base):
    __tablename__ = "EquipmentCostProfile"
    __table_args__ = (
        UniqueConstraint(
            "equipment_type", "version", name="uq_equipment_cost_profile_version"
        ),
    )

    cost_profile_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    equipment_type: Mapped[str] = mapped_column(String(80))
    version: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    external_rental_daily_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    transfer_fixed_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    transfer_cost_per_km: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    idle_daily_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    shortage_penalty_daily: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[Optional[date]] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class OptimizationRun(Base):
    __tablename__ = "OptimizationRun"
    __table_args__ = (Index("ix_optimization_run_created", "created_at"),)

    optimization_run_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    company_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("Company.company_id", ondelete="CASCADE")
    )
    dealer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("Dealer.dealer_id", ondelete="CASCADE")
    )
    planning_start: Mapped[date] = mapped_column(Date)
    planning_end: Mapped[date] = mapped_column(Date)
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    optimizer_version: Mapped[str] = mapped_column(String(40))
    input_watermark: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20))
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_by: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class OptimizationCandidate(Base):
    __tablename__ = "OptimizationCandidate"
    __table_args__ = (
        Index("ix_optimization_candidate_run", "optimization_run_id"),
    )

    candidate_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    optimization_run_id: Mapped[int] = mapped_column(
        ForeignKey("OptimizationRun.optimization_run_id", ondelete="CASCADE")
    )
    action: Mapped[str] = mapped_column(String(40))
    recommended_units: Mapped[int] = mapped_column(Integer, default=1)
    equipment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("Equipment.equipment_id", ondelete="SET NULL")
    )
    equipment_type: Mapped[str] = mapped_column(String(80))
    source_site_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ProjectSite.site_id", ondelete="SET NULL")
    )
    destination_site_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ProjectSite.site_id", ondelete="SET NULL")
    )
    requirement_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("PhaseEquipmentRequirement.requirement_id", ondelete="SET NULL")
    )
    feasible: Mapped[bool] = mapped_column(Boolean)
    rejection_reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    distance_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    transfer_lead_days: Mapped[Optional[int]] = mapped_column(Integer)
    baseline_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    candidate_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    net_savings: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    risk_penalty: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    optimization_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4))
    cost_breakdown: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    explanation: Mapped[str] = mapped_column(Text)


class OptimizationRecommendation(Base):
    __tablename__ = "OptimizationRecommendation"
    __table_args__ = (
        Index("ix_optimization_recommendation_status", "status", "created_at"),
    )

    recommendation_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    optimization_run_id: Mapped[int] = mapped_column(
        ForeignKey("OptimizationRun.optimization_run_id", ondelete="CASCADE")
    )
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("OptimizationCandidate.candidate_id", ondelete="CASCADE")
    )
    status: Mapped[str] = mapped_column(String(24), default="PROPOSED")
    version: Mapped[int] = mapped_column(Integer, default=1)
    decision_reason: Mapped[Optional[str]] = mapped_column(Text)
    decision_idempotency_key: Mapped[Optional[str]] = mapped_column(
        String(160), unique=True
    )
    decided_by: Mapped[Optional[str]] = mapped_column(String(80))
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
