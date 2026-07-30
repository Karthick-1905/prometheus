"""App notifications for rental alerts and site bookings

Revision ID: 003_app_notifications
Revises: 002_demand_forecasting
Create Date: 2026-07-31
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_app_notifications"
down_revision: Union[str, None] = "002_demand_forecasting"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "AppNotification",
        sa.Column("notification_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("Company.company_id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "dealer_id",
            sa.Integer(),
            sa.ForeignKey("Dealer.dealer_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("site_id", sa.Integer(), nullable=True),
        sa.Column("contract_id", sa.Integer(), nullable=True),
        sa.Column("equipment_id", sa.Integer(), nullable=True),
        sa.Column("assignment_id", sa.Integer(), nullable=True),
        sa.Column("notification_type", sa.String(40), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="INFO"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("action_url", sa.String(500), nullable=True),
        sa.Column("action_label", sa.String(80), nullable=True),
        sa.Column("recipient_email", sa.String(200), nullable=True),
        sa.Column("email_status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("email_error", sa.Text(), nullable=True),
        sa.Column("email_sent_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("dedupe_key", sa.String(160), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=False),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_app_notification_company_created",
        "AppNotification",
        ["company_id", "created_at"],
    )
    op.create_index(
        "ix_app_notification_dedupe",
        "AppNotification",
        ["dedupe_key"],
        unique=True,
    )
    op.create_index(
        "ix_app_notification_unread",
        "AppNotification",
        ["company_id", "is_read", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_app_notification_unread", table_name="AppNotification")
    op.drop_index("ix_app_notification_dedupe", table_name="AppNotification")
    op.drop_index("ix_app_notification_company_created", table_name="AppNotification")
    op.drop_table("AppNotification")
