"""Demand-forecasting domain models.

Operational request/event tables remain the source of truth. Weekly demand and
forecast tables are versioned analytical records used for serving and audit.
"""
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


class Project(Base):
    __tablename__ = "Project"
    __table_args__ = (
        UniqueConstraint("company_id", "project_code", name="uq_project_company_code"),
        Index("ix_project_status_region", "project_status", "region"),
    )

    project_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("Company.company_id", ondelete="CASCADE"))
    site_id: Mapped[int] = mapped_column(ForeignKey("ProjectSite.site_id", ondelete="RESTRICT"))
    project_code: Mapped[str] = mapped_column(String(50))
    project_name: Mapped[str] = mapped_column(String(160))
    project_type: Mapped[str] = mapped_column(String(80))
    project_size: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    project_size_unit: Mapped[str] = mapped_column(String(30))
    region: Mapped[str] = mapped_column(String(80))
    current_phase: Mapped[str] = mapped_column(String(80))
    phase_start_date: Mapped[date] = mapped_column(Date)
    phase_end_date: Mapped[date] = mapped_column(Date)
    expected_project_end: Mapped[date] = mapped_column(Date)
    project_status: Mapped[str] = mapped_column(String(20))
    priority: Mapped[str] = mapped_column(String(20), default="STANDARD")
    progress_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DemandRequest(Base):
    __tablename__ = "DemandRequest"
    __table_args__ = (
        Index("ix_demand_request_project_type_start", "project_id", "equipment_type", "required_start"),
    )

    demand_request_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_key: Mapped[str] = mapped_column(String(80), unique=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("Project.project_id", ondelete="CASCADE"))
    equipment_type: Mapped[str] = mapped_column(String(80))
    requested_units: Mapped[int] = mapped_column(Integer)
    planned_machine_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    safety_buffer_units: Mapped[int] = mapped_column(Integer, default=0)
    required_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    required_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    request_status: Mapped[str] = mapped_column(String(20))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    substitute_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DemandFulfillment(Base):
    __tablename__ = "DemandFulfillment"

    fulfillment_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    demand_request_id: Mapped[int] = mapped_column(
        ForeignKey("DemandRequest.demand_request_id", ondelete="CASCADE")
    )
    fulfilled_units: Mapped[int] = mapped_column(Integer)
    equipment_type_supplied: Mapped[str] = mapped_column(String(80))
    fulfillment_status: Mapped[str] = mapped_column(String(20))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HistoricalWeeklyDemand(Base):
    __tablename__ = "HistoricalWeeklyDemand"
    __table_args__ = (
        UniqueConstraint(
            "week_start", "project_id", "equipment_type", name="uq_weekly_demand_project_equipment"
        ),
        Index("ix_weekly_demand_type_week", "equipment_type", "week_start"),
    )

    weekly_demand_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    week_start: Mapped[date] = mapped_column(Date)
    customer_id: Mapped[int] = mapped_column(ForeignKey("Company.company_id", ondelete="CASCADE"))
    project_id: Mapped[int] = mapped_column(ForeignKey("Project.project_id", ondelete="CASCADE"))
    site_id: Mapped[int] = mapped_column(ForeignKey("ProjectSite.site_id", ondelete="RESTRICT"))
    project_type: Mapped[str] = mapped_column(String(80))
    project_size: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    project_size_unit: Mapped[str] = mapped_column(String(30))
    region: Mapped[str] = mapped_column(String(80))
    project_phase: Mapped[str] = mapped_column(String(80))
    equipment_type: Mapped[str] = mapped_column(String(80))
    requested_units: Mapped[int] = mapped_column(Integer)
    fulfilled_units: Mapped[int] = mapped_column(Integer)
    rented_units: Mapped[int] = mapped_column(Integer)
    engine_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    idle_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    rented_days: Mapped[int] = mapped_column(Integer)
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    machine_days: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    project_status: Mapped[str] = mapped_column(String(20))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EquipmentAvailability(Base):
    __tablename__ = "EquipmentAvailability"
    __table_args__ = (
        Index("ix_equipment_availability_region_type", "current_region", "equipment_type", "status"),
    )

    availability_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("Equipment.equipment_id", ondelete="CASCADE"))
    equipment_type: Mapped[str] = mapped_column(String(80))
    equipment_capacity: Mapped[Optional[str]] = mapped_column(String(80))
    equipment_model: Mapped[Optional[str]] = mapped_column(String(80))
    current_region: Mapped[str] = mapped_column(String(80))
    current_site_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ProjectSite.site_id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(24))
    available_from: Mapped[date] = mapped_column(Date)
    expected_return_date: Mapped[Optional[date]] = mapped_column(Date)
    snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PackageCatalog(Base):
    __tablename__ = "PackageCatalog"
    __table_args__ = (
        UniqueConstraint("package_code", "version", name="uq_package_code_version"),
        Index("ix_package_type_effective", "equipment_type", "effective_from"),
    )

    package_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    package_code: Mapped[str] = mapped_column(String(60))
    version: Mapped[int] = mapped_column(Integer)
    package_name: Mapped[str] = mapped_column(String(120))
    equipment_type: Mapped[str] = mapped_column(String(80))
    billing_model: Mapped[str] = mapped_column(String(30))
    duration_days: Mapped[int] = mapped_column(Integer)
    included_units: Mapped[int] = mapped_column(Integer)
    included_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    base_charge: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    extra_hour_charge: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    minimum_commitment: Mapped[int] = mapped_column(Integer)
    cancellation_policy: Mapped[str] = mapped_column(Text)
    flexibility_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    description: Mapped[str] = mapped_column(Text)
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[Optional[date]] = mapped_column(Date)
    simulated_pricing: Mapped[bool] = mapped_column(Boolean, default=True)


class ModelVersion(Base):
    __tablename__ = "ModelVersion"

    model_version_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_name: Mapped[str] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(80), unique=True)
    training_data_watermark: Mapped[str] = mapped_column(String(120))
    feature_schema_version: Mapped[str] = mapped_column(String(40))
    artifact_manifest: Mapped[dict[str, Any]] = mapped_column(JSON)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    promoted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ForecastRun(Base):
    __tablename__ = "ForecastRun"
    __table_args__ = (Index("ix_forecast_run_generated", "generated_at"),)

    forecast_run_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_version_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ModelVersion.model_version_id", ondelete="SET NULL")
    )
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    horizon_weeks: Mapped[int] = mapped_column(Integer, default=4)
    source_data_watermark: Mapped[str] = mapped_column(String(120))
    forecast_method: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    failure_summary: Mapped[Optional[str]] = mapped_column(Text)


class ForecastRecord(Base):
    __tablename__ = "ForecastRecord"
    __table_args__ = (
        UniqueConstraint(
            "forecast_run_id",
            "project_id",
            "equipment_type",
            "forecast_week",
            name="uq_forecast_run_project_type_week",
        ),
        Index("ix_forecast_project_type_week", "project_id", "equipment_type", "forecast_week"),
    )

    forecast_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    forecast_run_id: Mapped[int] = mapped_column(
        ForeignKey("ForecastRun.forecast_run_id", ondelete="CASCADE")
    )
    customer_id: Mapped[int] = mapped_column(ForeignKey("Company.company_id", ondelete="CASCADE"))
    project_id: Mapped[int] = mapped_column(ForeignKey("Project.project_id", ondelete="CASCADE"))
    site_id: Mapped[int] = mapped_column(ForeignKey("ProjectSite.site_id", ondelete="RESTRICT"))
    equipment_type: Mapped[str] = mapped_column(String(80))
    forecast_week: Mapped[date] = mapped_column(Date)
    predicted_units: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    lower_units: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    upper_units: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    safe_planning_units: Mapped[int] = mapped_column(Integer)
    predicted_machine_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    predicted_utilization: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    trend: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[str] = mapped_column(String(30))
    forecast_method: Mapped[str] = mapped_column(String(80))
    cold_start: Mapped[bool] = mapped_column(Boolean, default=False)
    explanation: Mapped[str] = mapped_column(Text)
    comparable_cohort: Mapped[Optional[str]] = mapped_column(String(240))
    version: Mapped[int] = mapped_column(Integer, default=1)


class PackageRecommendation(Base):
    __tablename__ = "PackageRecommendation"
    __table_args__ = (Index("ix_recommendation_project_created", "project_id", "created_at"),)

    recommendation_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("Project.project_id", ondelete="CASCADE"))
    equipment_type: Mapped[str] = mapped_column(String(80))
    forecast_run_id: Mapped[int] = mapped_column(
        ForeignKey("ForecastRun.forecast_run_id", ondelete="CASCADE")
    )
    recommended_package_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("PackageCatalog.package_id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(40))
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    estimated_unused_capacity: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    shortage_risk: Mapped[Decimal] = mapped_column(Numeric(6, 4))
    estimated_savings: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    score: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    explanation: Mapped[str] = mapped_column(Text)
    alternatives: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    pricing_version: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(24), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ForecastOverride(Base):
    __tablename__ = "ForecastOverride"
    __table_args__ = (Index("ix_override_forecast_created", "forecast_id", "created_at"),)

    override_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    forecast_id: Mapped[int] = mapped_column(
        ForeignKey("ForecastRecord.forecast_id", ondelete="CASCADE")
    )
    original_units: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    adjusted_units: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    original_machine_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    adjusted_machine_hours: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    actor_id: Mapped[str] = mapped_column(String(80))
    actor_role: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(Text)
    base_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecommendationFeedback(Base):
    __tablename__ = "RecommendationFeedback"

    feedback_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("PackageRecommendation.recommendation_id", ondelete="SET NULL")
    )
    forecast_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ForecastRecord.forecast_id", ondelete="SET NULL")
    )
    actor_id: Mapped[str] = mapped_column(String(80))
    actor_role: Mapped[str] = mapped_column(String(40))
    decision: Mapped[str] = mapped_column(String(30))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    selected_package_code: Mapped[Optional[str]] = mapped_column(String(60))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RegionalPositioningRecommendation(Base):
    __tablename__ = "RegionalPositioningRecommendation"

    positioning_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    forecast_run_id: Mapped[int] = mapped_column(
        ForeignKey("ForecastRun.forecast_run_id", ondelete="CASCADE")
    )
    equipment_type: Mapped[str] = mapped_column(String(80))
    forecast_week: Mapped[date] = mapped_column(Date)
    source_region: Mapped[Optional[str]] = mapped_column(String(80))
    destination_region: Mapped[str] = mapped_column(String(80))
    recommended_units: Mapped[int] = mapped_column(Integer)
    source_safety_buffer: Mapped[int] = mapped_column(Integer)
    transfer_lead_days: Mapped[int] = mapped_column(Integer)
    customer_impact: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="PROPOSED")
    approved_by: Mapped[Optional[str]] = mapped_column(String(80))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
