"""Baseline schema from prisma/schema.prisma

Revision ID: 001_baseline
Revises:
Create Date: 2026-07-30

For an existing Neon DB already created by Prisma:
    alembic stamp 001_baseline

For a fresh empty database:
    alembic upgrade head
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums (IF NOT EXISTS via raw SQL for Neon safety)
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE "UserRole" AS ENUM ('FLEET_MANAGER', 'SITE_ENGINEER');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE "ProjectSiteStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE "RentalContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'OVERDUE');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE "AnomalySeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE "AnomalyType" AS ENUM (
                'UNASSIGNED_OPERATOR','ENGINE_OVERHEAT','SEVERE_VIBRATION','EXPIRED_RENTAL',
                'MISSING_GPS','LOW_BATTERY','ENGINE_HOURS_TAMPER','EXCESSIVE_IDLE',
                'FUEL_LEAK_THEFT','GEOFENCE_VIOLATION','STATISTICAL_OUTLIER'
            );
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """
    )

    # Core tables — create only if missing (idempotent for Prisma-migrated Neon)
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Dealer" (
            dealer_id SERIAL PRIMARY KEY,
            dealer_name VARCHAR,
            email VARCHAR,
            phone VARCHAR,
            address TEXT,
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Company" (
            company_id SERIAL PRIMARY KEY,
            company_name VARCHAR,
            email VARCHAR,
            phone VARCHAR,
            address TEXT,
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "User" (
            user_id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES "Company"(company_id) ON DELETE CASCADE,
            name VARCHAR,
            email VARCHAR,
            password VARCHAR,
            role "UserRole",
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "ProjectSite" (
            site_id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES "Company"(company_id) ON DELETE CASCADE,
            site_name VARCHAR,
            location VARCHAR,
            status "ProjectSiteStatus",
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Equipment" (
            equipment_id SERIAL PRIMARY KEY,
            dealer_id INTEGER NOT NULL REFERENCES "Dealer"(dealer_id) ON DELETE CASCADE,
            equipment_name VARCHAR,
            equipment_type VARCHAR,
            model VARCHAR,
            serial_number VARCHAR,
            qr_code VARCHAR,
            rfid_tag VARCHAR,
            status "EquipmentStatus",
            daily_rental_cost DECIMAL(10,2),
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "RentalContract" (
            contract_id SERIAL PRIMARY KEY,
            dealer_id INTEGER NOT NULL REFERENCES "Dealer"(dealer_id) ON DELETE CASCADE,
            company_id INTEGER NOT NULL REFERENCES "Company"(company_id) ON DELETE CASCADE,
            equipment_id INTEGER NOT NULL REFERENCES "Equipment"(equipment_id) ON DELETE CASCADE,
            rental_start TIMESTAMP(6),
            expected_return TIMESTAMP(6),
            actual_return TIMESTAMP(6),
            rental_status "RentalContractStatus",
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "EquipmentAssignment" (
            assignment_id SERIAL PRIMARY KEY,
            contract_id INTEGER NOT NULL REFERENCES "RentalContract"(contract_id) ON DELETE CASCADE,
            site_id INTEGER NOT NULL REFERENCES "ProjectSite"(site_id) ON DELETE CASCADE,
            assigned_by INTEGER NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
            checked_out_by INTEGER NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
            checkout_time TIMESTAMP(6),
            checkin_time TIMESTAMP(6),
            status "AssignmentStatus",
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "UsageLog" (
            usage_id SERIAL PRIMARY KEY,
            assignment_id INTEGER NOT NULL REFERENCES "EquipmentAssignment"(assignment_id) ON DELETE CASCADE,
            runtime_hours DECIMAL(10,2),
            idle_hours DECIMAL(10,2),
            fuel_consumed DECIMAL(10,2),
            latitude DECIMAL(9,6),
            longitude DECIMAL(9,6),
            recorded_at TIMESTAMP(6)
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "EquipmentTelemetry" (
            telemetry_id BIGSERIAL PRIMARY KEY,
            equipment_id INTEGER NOT NULL REFERENCES "Equipment"(equipment_id) ON DELETE CASCADE,
            timestamp TIMESTAMP(6) NOT NULL,
            engine_status VARCHAR(10),
            fuel_level DECIMAL(5,2),
            engine_hours DECIMAL(10,2),
            idle_hours DECIMAL(10,2),
            speed DECIMAL(5,2),
            latitude DECIMAL(9,6),
            longitude DECIMAL(9,6),
            engine_temperature DECIMAL(5,2),
            hydraulic_pressure DECIMAL(7,2),
            battery_voltage DECIMAL(5,2),
            load_percentage DECIMAL(5,2),
            vibration_level DECIMAL(5,2),
            rental_status VARCHAR(20),
            created_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "AnomalyAlert" (
            alert_id SERIAL PRIMARY KEY,
            equipment_id VARCHAR NOT NULL,
            equipment_type VARCHAR,
            site_id VARCHAR,
            operator_id VARCHAR,
            anomaly_type "AnomalyType" NOT NULL,
            severity "AnomalySeverity" NOT NULL,
            description TEXT NOT NULL,
            recommendation TEXT NOT NULL,
            trigger_value VARCHAR,
            threshold_value VARCHAR,
            is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
            resolved_at TIMESTAMP(6),
            detected_at TIMESTAMP(6) DEFAULT NOW() NOT NULL
        );
        """
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_equipment_telemetry_eq_ts ON "EquipmentTelemetry" (equipment_id, timestamp);'
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_anomaly_alert_eq_detected ON "AnomalyAlert" (equipment_id, detected_at);'
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_anomaly_alert_resolved_detected ON "AnomalyAlert" (is_resolved, detected_at);'
    )


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS "AnomalyAlert" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "EquipmentTelemetry" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "UsageLog" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "EquipmentAssignment" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "RentalContract" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "Equipment" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "ProjectSite" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "User" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "Company" CASCADE;')
    op.execute('DROP TABLE IF EXISTS "Dealer" CASCADE;')
