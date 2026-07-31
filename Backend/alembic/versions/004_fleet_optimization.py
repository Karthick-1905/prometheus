"""Project-phase-aware fleet optimization

Revision ID: 004_fleet_optimization
Revises: 003_app_notifications
Create Date: 2026-07-31
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_fleet_optimization"
down_revision: Union[str, None] = "003_app_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ProjectSite", sa.Column("latitude", sa.Numeric(9, 6)))
    op.add_column("ProjectSite", sa.Column("longitude", sa.Numeric(9, 6)))

    op.create_table(
        "ProjectPhase",
        sa.Column("phase_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("Project.project_id", ondelete="CASCADE"), nullable=False),
        sa.Column("phase_code", sa.String(50), nullable=False),
        sa.Column("phase_name", sa.String(120), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("planned_start", sa.Date(), nullable=False),
        sa.Column("planned_end", sa.Date(), nullable=False),
        sa.Column("actual_start", sa.Date()),
        sa.Column("actual_end", sa.Date()),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("progress_percentage", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("schedule_confidence", sa.String(20), nullable=False, server_default="MODERATE"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("sequence > 0", name="ck_project_phase_sequence"),
        sa.CheckConstraint("planned_end >= planned_start", name="ck_project_phase_dates"),
        sa.CheckConstraint("progress_percentage >= 0 AND progress_percentage <= 100", name="ck_project_phase_progress"),
        sa.UniqueConstraint("project_id", "sequence", name="uq_project_phase_sequence"),
    )
    op.create_index("ix_project_phase_status_dates", "ProjectPhase", ["status", "planned_start", "planned_end"])

    op.create_table(
        "PhaseEquipmentRequirement",
        sa.Column("requirement_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("phase_id", sa.Integer(), sa.ForeignKey("ProjectPhase.phase_id", ondelete="CASCADE"), nullable=False),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("required_capability", sa.String(80)),
        sa.Column("minimum_capacity", sa.Numeric(12, 2)),
        sa.Column("required_units", sa.Integer(), nullable=False),
        sa.Column("planned_machine_hours", sa.Numeric(12, 2)),
        sa.Column("required_from", sa.Date(), nullable=False),
        sa.Column("required_until", sa.Date(), nullable=False),
        sa.Column("criticality", sa.String(20), nullable=False, server_default="STANDARD"),
        sa.Column("maximum_allowed_downtime_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("substitution_allowed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source", sa.String(30), nullable=False, server_default="PROJECT_PLAN"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("required_units > 0", name="ck_phase_requirement_units"),
        sa.CheckConstraint("required_until >= required_from", name="ck_phase_requirement_dates"),
    )
    op.create_index(
        "ix_phase_requirement_type_dates",
        "PhaseEquipmentRequirement",
        ["equipment_type", "required_from", "required_until"],
    )

    op.create_table(
        "EquipmentCapability",
        sa.Column("capability_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("capability_code", sa.String(80), nullable=False),
        sa.Column("capacity_value", sa.Numeric(12, 2)),
        sa.Column("capacity_unit", sa.String(30)),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("equipment_type", "capability_code", name="uq_equipment_type_capability"),
    )

    op.create_table(
        "EquipmentSubstitutionRule",
        sa.Column("substitution_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("required_equipment_type", sa.String(80), nullable=False),
        sa.Column("substitute_equipment_type", sa.String(80), nullable=False),
        sa.Column("productivity_ratio", sa.Numeric(6, 4), nullable=False, server_default="1"),
        sa.Column("cost_penalty_percentage", sa.Numeric(6, 4), nullable=False, server_default="0"),
        sa.Column("approval_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("restrictions", sa.JSON(), nullable=False),
        sa.UniqueConstraint(
            "required_equipment_type",
            "substitute_equipment_type",
            name="uq_equipment_substitution_pair",
        ),
    )

    op.create_table(
        "EquipmentCostProfile",
        sa.Column("cost_profile_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("external_rental_daily_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("transfer_fixed_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("transfer_cost_per_km", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("idle_daily_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("shortage_penalty_daily", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("equipment_type", "version", name="uq_equipment_cost_profile_version"),
    )

    op.create_table(
        "OptimizationRun",
        sa.Column("optimization_run_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("Company.company_id", ondelete="CASCADE")),
        sa.Column("dealer_id", sa.Integer(), sa.ForeignKey("Dealer.dealer_id", ondelete="CASCADE")),
        sa.Column("planning_start", sa.Date(), nullable=False),
        sa.Column("planning_end", sa.Date(), nullable=False),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("optimizer_version", sa.String(40), nullable=False),
        sa.Column("input_watermark", sa.String(80), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_optimization_run_created", "OptimizationRun", ["created_at"])

    op.create_table(
        "OptimizationCandidate",
        sa.Column("candidate_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("optimization_run_id", sa.Integer(), sa.ForeignKey("OptimizationRun.optimization_run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("recommended_units", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("Equipment.equipment_id", ondelete="SET NULL")),
        sa.Column("equipment_type", sa.String(80), nullable=False),
        sa.Column("source_site_id", sa.Integer(), sa.ForeignKey("ProjectSite.site_id", ondelete="SET NULL")),
        sa.Column("destination_site_id", sa.Integer(), sa.ForeignKey("ProjectSite.site_id", ondelete="SET NULL")),
        sa.Column("requirement_id", sa.Integer(), sa.ForeignKey("PhaseEquipmentRequirement.requirement_id", ondelete="SET NULL")),
        sa.Column("feasible", sa.Boolean(), nullable=False),
        sa.Column("rejection_reasons", sa.JSON(), nullable=False),
        sa.Column("distance_km", sa.Numeric(10, 2)),
        sa.Column("transfer_lead_days", sa.Integer()),
        sa.Column("baseline_cost", sa.Numeric(14, 2)),
        sa.Column("candidate_cost", sa.Numeric(14, 2)),
        sa.Column("net_savings", sa.Numeric(14, 2)),
        sa.Column("risk_penalty", sa.Numeric(14, 2)),
        sa.Column("optimization_score", sa.Numeric(14, 4)),
        sa.Column("cost_breakdown", sa.JSON(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
    )
    op.create_index("ix_optimization_candidate_run", "OptimizationCandidate", ["optimization_run_id"])

    op.create_table(
        "OptimizationRecommendation",
        sa.Column("recommendation_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("optimization_run_id", sa.Integer(), sa.ForeignKey("OptimizationRun.optimization_run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("OptimizationCandidate.candidate_id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="PROPOSED"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("decision_reason", sa.Text()),
        sa.Column("decision_idempotency_key", sa.String(160), unique=True),
        sa.Column("decided_by", sa.String(80)),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_optimization_recommendation_status",
        "OptimizationRecommendation",
        ["status", "created_at"],
    )


def downgrade() -> None:
    for table in [
        "OptimizationRecommendation",
        "OptimizationCandidate",
        "OptimizationRun",
        "EquipmentCostProfile",
        "EquipmentSubstitutionRule",
        "EquipmentCapability",
        "PhaseEquipmentRequirement",
        "ProjectPhase",
    ]:
        op.drop_table(table)
    op.drop_column("ProjectSite", "longitude")
    op.drop_column("ProjectSite", "latitude")
