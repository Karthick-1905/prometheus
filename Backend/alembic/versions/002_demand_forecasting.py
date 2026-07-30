"""Demand forecasting domain

Revision ID: 002_demand_forecasting
Revises: 001_baseline
Create Date: 2026-07-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_demand_forecasting"
down_revision: Union[str, None] = "001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "Project",
        sa.Column("project_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("Company.company_id", ondelete="CASCADE"), nullable=False),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("ProjectSite.site_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("project_code", sa.String(50), nullable=False),
        sa.Column("project_name", sa.String(160), nullable=False),
        sa.Column("project_type", sa.String(80), nullable=False),
        sa.Column("project_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("project_size_unit", sa.String(30), nullable=False),
        sa.Column("region", sa.String(80), nullable=False),
        sa.Column("current_phase", sa.String(80), nullable=False),
        sa.Column("phase_start_date", sa.Date(), nullable=False),
        sa.Column("phase_end_date", sa.Date(), nullable=False),
        sa.Column("expected_project_end", sa.Date(), nullable=False),
        sa.Column("project_status", sa.String(20), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="STANDARD"),
        sa.Column("progress_percentage", sa.Numeric(5, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("project_size > 0", name="ck_project_positive_size"),
        sa.CheckConstraint("phase_end_date >= phase_start_date", name="ck_project_phase_dates"),
        sa.CheckConstraint("expected_project_end >= phase_start_date", name="ck_project_end_date"),
        sa.UniqueConstraint("company_id", "project_code", name="uq_project_company_code"),
    )
    op.create_index("ix_project_status_region", "Project", ["project_status", "region"])

    op.create_table(
        "DemandRequest",
        sa.Column("demand_request_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("request_key", sa.String(80), nullable=False, unique=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("Project.project_id", ondelete="CASCADE"), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("requested_units", sa.Integer(), nullable=False),
        sa.Column("planned_machine_hours", sa.Numeric(12, 2)),
        sa.Column("safety_buffer_units", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("required_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("required_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_status", sa.String(20), nullable=False),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column("substitute_accepted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("requested_units >= 0", name="ck_demand_request_units"),
        sa.CheckConstraint("safety_buffer_units >= 0", name="ck_demand_buffer_units"),
        sa.CheckConstraint("required_end > required_start", name="ck_demand_request_dates"),
    )
    op.create_index(
        "ix_demand_request_project_type_start",
        "DemandRequest",
        ["project_id", "equipment_type", "required_start"],
    )

    op.create_table(
        "DemandFulfillment",
        sa.Column("fulfillment_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "demand_request_id",
            sa.Integer(),
            sa.ForeignKey("DemandRequest.demand_request_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fulfilled_units", sa.Integer(), nullable=False),
        sa.Column("equipment_type_supplied", sa.String(80), nullable=False),
        sa.Column("fulfillment_status", sa.String(20), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("fulfilled_units >= 0", name="ck_fulfillment_units"),
    )

    op.create_table(
        "HistoricalWeeklyDemand",
        sa.Column("weekly_demand_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("Company.company_id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("Project.project_id", ondelete="CASCADE"), nullable=False),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("ProjectSite.site_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("project_type", sa.String(80), nullable=False),
        sa.Column("project_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("project_size_unit", sa.String(30), nullable=False),
        sa.Column("region", sa.String(80), nullable=False),
        sa.Column("project_phase", sa.String(80), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("requested_units", sa.Integer(), nullable=False),
        sa.Column("fulfilled_units", sa.Integer(), nullable=False),
        sa.Column("rented_units", sa.Integer(), nullable=False),
        sa.Column("engine_hours", sa.Numeric(12, 2), nullable=False),
        sa.Column("idle_hours", sa.Numeric(12, 2), nullable=False),
        sa.Column("rented_days", sa.Integer(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("machine_days", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("project_status", sa.String(20), nullable=False),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "requested_units >= 0 AND fulfilled_units >= 0 AND rented_units >= 0",
            name="ck_weekly_demand_nonnegative_units",
        ),
        sa.CheckConstraint("fulfilled_units <= requested_units", name="ck_weekly_demand_fulfilled"),
        sa.CheckConstraint("rented_units <= fulfilled_units", name="ck_weekly_demand_rented"),
        sa.CheckConstraint("engine_hours >= 0 AND idle_hours >= 0", name="ck_weekly_demand_hours"),
        sa.UniqueConstraint(
            "week_start", "project_id", "equipment_type", name="uq_weekly_demand_project_equipment"
        ),
    )
    op.create_index(
        "ix_weekly_demand_type_week", "HistoricalWeeklyDemand", ["equipment_type", "week_start"]
    )

    op.create_table(
        "EquipmentAvailability",
        sa.Column("availability_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("Equipment.equipment_id", ondelete="CASCADE"), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("equipment_capacity", sa.String(80)),
        sa.Column("equipment_model", sa.String(80)),
        sa.Column("current_region", sa.String(80), nullable=False),
        sa.Column("current_site_id", sa.Integer(), sa.ForeignKey("ProjectSite.site_id", ondelete="SET NULL")),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("available_from", sa.Date(), nullable=False),
        sa.Column("expected_return_date", sa.Date()),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_equipment_availability_region_type",
        "EquipmentAvailability",
        ["current_region", "equipment_type", "status"],
    )

    op.create_table(
        "PackageCatalog",
        sa.Column("package_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("package_code", sa.String(60), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("package_name", sa.String(120), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("billing_model", sa.String(30), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("included_units", sa.Integer(), nullable=False),
        sa.Column("included_hours", sa.Numeric(12, 2), nullable=False),
        sa.Column("base_charge", sa.Numeric(12, 2), nullable=False),
        sa.Column("extra_hour_charge", sa.Numeric(10, 2), nullable=False),
        sa.Column("minimum_commitment", sa.Integer(), nullable=False),
        sa.Column("cancellation_policy", sa.Text(), nullable=False),
        sa.Column("flexibility_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date()),
        sa.Column("simulated_pricing", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint(
            "duration_days > 0 AND included_units >= 0 AND included_hours >= 0",
            name="ck_package_capacity",
        ),
        sa.CheckConstraint(
            "base_charge >= 0 AND extra_hour_charge >= 0", name="ck_package_prices"
        ),
        sa.UniqueConstraint("package_code", "version", name="uq_package_code_version"),
    )
    op.create_index(
        "ix_package_type_effective", "PackageCatalog", ["equipment_type", "effective_from"]
    )

    op.create_table(
        "ModelVersion",
        sa.Column("model_version_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("version", sa.String(80), nullable=False, unique=True),
        sa.Column("training_data_watermark", sa.String(120), nullable=False),
        sa.Column("feature_schema_version", sa.String(40), nullable=False),
        sa.Column("artifact_manifest", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("promoted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "ForecastRun",
        sa.Column("forecast_run_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("ModelVersion.model_version_id", ondelete="SET NULL")),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("horizon_weeks", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("source_data_watermark", sa.String(120), nullable=False),
        sa.Column("forecast_method", sa.String(80), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("failure_summary", sa.Text()),
    )
    op.create_index("ix_forecast_run_generated", "ForecastRun", ["generated_at"])

    op.create_table(
        "ForecastRecord",
        sa.Column("forecast_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("forecast_run_id", sa.Integer(), sa.ForeignKey("ForecastRun.forecast_run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("Company.company_id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("Project.project_id", ondelete="CASCADE"), nullable=False),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("ProjectSite.site_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("forecast_week", sa.Date(), nullable=False),
        sa.Column("predicted_units", sa.Numeric(8, 2), nullable=False),
        sa.Column("lower_units", sa.Numeric(8, 2), nullable=False),
        sa.Column("upper_units", sa.Numeric(8, 2), nullable=False),
        sa.Column("safe_planning_units", sa.Integer(), nullable=False),
        sa.Column("predicted_machine_hours", sa.Numeric(12, 2), nullable=False),
        sa.Column("predicted_utilization", sa.Numeric(5, 4)),
        sa.Column("trend", sa.String(20), nullable=False),
        sa.Column("confidence", sa.String(30), nullable=False),
        sa.Column("forecast_method", sa.String(80), nullable=False),
        sa.Column("cold_start", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("comparable_cohort", sa.String(240)),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint(
            "lower_units >= 0 AND predicted_units >= lower_units AND upper_units >= predicted_units",
            name="ck_forecast_interval",
        ),
        sa.UniqueConstraint(
            "forecast_run_id",
            "project_id",
            "equipment_type",
            "forecast_week",
            name="uq_forecast_run_project_type_week",
        ),
    )
    op.create_index(
        "ix_forecast_project_type_week",
        "ForecastRecord",
        ["project_id", "equipment_type", "forecast_week"],
    )

    op.create_table(
        "PackageRecommendation",
        sa.Column("recommendation_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("Project.project_id", ondelete="CASCADE"), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("forecast_run_id", sa.Integer(), sa.ForeignKey("ForecastRun.forecast_run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("recommended_package_id", sa.Integer(), sa.ForeignKey("PackageCatalog.package_id", ondelete="SET NULL")),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("estimated_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("estimated_unused_capacity", sa.Numeric(12, 2), nullable=False),
        sa.Column("shortage_risk", sa.Numeric(6, 4), nullable=False),
        sa.Column("estimated_savings", sa.Numeric(12, 2), nullable=False),
        sa.Column("score", sa.Numeric(12, 4), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("alternatives", sa.JSON(), nullable=False),
        sa.Column("pricing_version", sa.String(60), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_recommendation_project_created",
        "PackageRecommendation",
        ["project_id", "created_at"],
    )

    op.create_table(
        "ForecastOverride",
        sa.Column("override_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("forecast_id", sa.Integer(), sa.ForeignKey("ForecastRecord.forecast_id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_units", sa.Numeric(8, 2), nullable=False),
        sa.Column("adjusted_units", sa.Numeric(8, 2), nullable=False),
        sa.Column("original_machine_hours", sa.Numeric(12, 2), nullable=False),
        sa.Column("adjusted_machine_hours", sa.Numeric(12, 2), nullable=False),
        sa.Column("actor_id", sa.String(80), nullable=False),
        sa.Column("actor_role", sa.String(40), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("base_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_override_forecast_created", "ForecastOverride", ["forecast_id", "created_at"]
    )

    op.create_table(
        "RecommendationFeedback",
        sa.Column("feedback_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("recommendation_id", sa.Integer(), sa.ForeignKey("PackageRecommendation.recommendation_id", ondelete="SET NULL")),
        sa.Column("forecast_id", sa.Integer(), sa.ForeignKey("ForecastRecord.forecast_id", ondelete="SET NULL")),
        sa.Column("actor_id", sa.String(80), nullable=False),
        sa.Column("actor_role", sa.String(40), nullable=False),
        sa.Column("decision", sa.String(30), nullable=False),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column("selected_package_code", sa.String(60)),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "RegionalPositioningRecommendation",
        sa.Column("positioning_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("forecast_run_id", sa.Integer(), sa.ForeignKey("ForecastRun.forecast_run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("forecast_week", sa.Date(), nullable=False),
        sa.Column("source_region", sa.String(80)),
        sa.Column("destination_region", sa.String(80), nullable=False),
        sa.Column("recommended_units", sa.Integer(), nullable=False),
        sa.Column("source_safety_buffer", sa.Integer(), nullable=False),
        sa.Column("transfer_lead_days", sa.Integer(), nullable=False),
        sa.Column("customer_impact", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="PROPOSED"),
        sa.Column("approved_by", sa.String(80)),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("recommended_units >= 0", name="ck_positioning_units"),
    )


def downgrade() -> None:
    for table in [
        "RegionalPositioningRecommendation",
        "RecommendationFeedback",
        "ForecastOverride",
        "PackageRecommendation",
        "ForecastRecord",
        "ForecastRun",
        "ModelVersion",
        "PackageCatalog",
        "EquipmentAvailability",
        "HistoricalWeeklyDemand",
        "DemandFulfillment",
        "DemandRequest",
        "Project",
    ]:
        op.drop_table(table)
