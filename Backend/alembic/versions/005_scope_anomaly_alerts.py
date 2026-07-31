"""Persist tenant scope on anomaly alerts.

Revision ID: 005_scope_anomaly_alerts
Revises: 004_fleet_optimization
Create Date: 2026-07-31
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_scope_anomaly_alerts"
down_revision: Union[str, None] = "004_fleet_optimization"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "AnomalyAlert",
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("Company.company_id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    # Attribute existing alerts to the most recent rental known for the machine.
    # Alerts without any rental remain system-level/unscoped and are never
    # returned to tenant principals.
    op.execute(
        """
        UPDATE "AnomalyAlert" AS alert
        SET company_id = (
            SELECT contract.company_id
            FROM "RentalContract" AS contract
            WHERE CAST(contract.equipment_id AS TEXT) = alert.equipment_id
              AND (
                alert.detected_at IS NULL
                OR contract.rental_start IS NULL
                OR contract.rental_start <= alert.detected_at
              )
            ORDER BY contract.rental_start DESC NULLS LAST, contract.contract_id DESC
            LIMIT 1
        )
        WHERE alert.company_id IS NULL
        """
    )
    op.create_index(
        "ix_anomaly_alert_company_resolved_detected",
        "AnomalyAlert",
        ["company_id", "is_resolved", "detected_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_anomaly_alert_company_resolved_detected", table_name="AnomalyAlert"
    )
    op.drop_column("AnomalyAlert", "company_id")
