"""Shared fixtures for Backend tests.

Fleet/alerts tests use in-memory SQLite so Neon is not required.
Demand forecasting tests keep using synthetic in-memory service (no DB).
"""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.domain import (
    AnomalyAlert,
    Company,
    Dealer,
    Equipment,
    EquipmentAssignment,
    EquipmentTelemetry,
    ProjectSite,
    RentalContract,
    UsageLog,
    User,
)
from app.models.enums import (
    AnomalySeverity,
    AnomalyType,
    AssignmentStatus,
    EquipmentStatus,
    ProjectSiteStatus,
    RentalContractStatus,
    UserRole,
)


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_conn, _connection_record):  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Domain tables only — avoid coupling fleet tests to demand forecasting schema.
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Dealer.__table__,
            Company.__table__,
            User.__table__,
            ProjectSite.__table__,
            Equipment.__table__,
            RentalContract.__table__,
            EquipmentAssignment.__table__,
            EquipmentTelemetry.__table__,
            UsageLog.__table__,
            AnomalyAlert.__table__,
        ],
    )
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    SessionLocal = sessionmaker(bind=db_engine, autoflush=False, autocommit=False)
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def seed_fleet(db_session: Session):
    """Minimal dealer / company / equipment / contract / telemetry / usage / alert."""
    dealer = Dealer(dealer_name="Metro CAT", email="dealer@example.com")
    company = Company(company_name="North Build Co", email="fleet@example.com")
    db_session.add_all([dealer, company])
    db_session.flush()

    user = User(
        company_id=company.company_id,
        name="Fleet Lead",
        email="fm@example.com",
        role=UserRole.FLEET_MANAGER,
    )
    site = ProjectSite(
        company_id=company.company_id,
        site_name="North Pit",
        location="37.77,-122.42",
        status=ProjectSiteStatus.ACTIVE,
    )
    db_session.add_all([user, site])
    db_session.flush()

    eq1 = Equipment(
        dealer_id=dealer.dealer_id,
        equipment_name="CAT 320",
        equipment_type="Excavator",
        status=EquipmentStatus.RENTED,
        qr_code="QR-EQ-1",
    )
    eq2 = Equipment(
        dealer_id=dealer.dealer_id,
        equipment_name="CAT Crane",
        equipment_type="Crane",
        status=EquipmentStatus.RENTED,
        qr_code="QR-EQ-2",
    )
    db_session.add_all([eq1, eq2])
    db_session.flush()

    now = datetime.utcnow()
    c1 = RentalContract(
        dealer_id=dealer.dealer_id,
        company_id=company.company_id,
        equipment_id=eq1.equipment_id,
        rental_start=now - timedelta(days=10),
        expected_return=now + timedelta(days=5),
        rental_status=RentalContractStatus.ACTIVE,
    )
    c2 = RentalContract(
        dealer_id=dealer.dealer_id,
        company_id=company.company_id,
        equipment_id=eq2.equipment_id,
        rental_start=now - timedelta(days=20),
        expected_return=now - timedelta(days=1),
        rental_status=RentalContractStatus.OVERDUE,
    )
    db_session.add_all([c1, c2])
    db_session.flush()

    assignment = EquipmentAssignment(
        contract_id=c1.contract_id,
        site_id=site.site_id,
        assigned_by=user.user_id,
        checked_out_by=user.user_id,
        checkout_time=now - timedelta(hours=2),
        status=AssignmentStatus.ACTIVE,
    )
    db_session.add(assignment)
    db_session.flush()

    # Usage logs — primary analytics source for excavator (eq1)
    usage1 = UsageLog(
        assignment_id=assignment.assignment_id,
        runtime_hours=Decimal("28.0"),
        idle_hours=Decimal("12.0"),
        fuel_consumed=Decimal("180.0"),
        latitude=Decimal("37.774900"),
        longitude=Decimal("-122.419400"),
        recorded_at=now - timedelta(days=1),
    )
    usage2 = UsageLog(
        assignment_id=assignment.assignment_id,
        runtime_hours=Decimal("22.0"),
        idle_hours=Decimal("18.0"),
        fuel_consumed=Decimal("140.0"),
        latitude=Decimal("37.774900"),
        longitude=Decimal("-122.419400"),
        recorded_at=now - timedelta(hours=6),
    )
    db_session.add_all([usage1, usage2])

    # SQLite does not autoincrement BigInteger PKs the same way as Postgres —
    # set telemetry_id explicitly for tests.
    # eq1: two readings (engine-hour deltas for telemetry fallback)
    tel1a = EquipmentTelemetry(
        telemetry_id=1,
        equipment_id=eq1.equipment_id,
        timestamp=now - timedelta(days=2),
        engine_status="ON",
        fuel_level=Decimal("90.0"),
        engine_hours=Decimal("1180.0"),
        idle_hours=Decimal("90.0"),
        speed=Decimal("4.0"),
        latitude=Decimal("37.774900"),
        longitude=Decimal("-122.419400"),
        engine_temperature=Decimal("88.0"),
        battery_voltage=Decimal("13.5"),
        load_percentage=Decimal("55.0"),
        vibration_level=Decimal("2.0"),
        rental_status="Working",
    )
    tel1b = EquipmentTelemetry(
        telemetry_id=2,
        equipment_id=eq1.equipment_id,
        timestamp=now - timedelta(minutes=2),
        engine_status="ON",
        fuel_level=Decimal("72.5"),
        engine_hours=Decimal("1200.0"),
        idle_hours=Decimal("100.0"),
        speed=Decimal("4.0"),
        latitude=Decimal("37.774900"),
        longitude=Decimal("-122.419400"),
        engine_temperature=Decimal("88.0"),
        battery_voltage=Decimal("13.5"),
        load_percentage=Decimal("55.0"),
        vibration_level=Decimal("2.0"),
        rental_status="Working",
    )
    # eq2: mostly idle/off → underutilized via telemetry (no usage logs)
    tel2a = EquipmentTelemetry(
        telemetry_id=3,
        equipment_id=eq2.equipment_id,
        timestamp=now - timedelta(days=3),
        engine_status="OFF",
        fuel_level=Decimal("45.0"),
        engine_hours=Decimal("800.0"),
        idle_hours=Decimal("190.0"),
        speed=Decimal("0"),
        latitude=Decimal("37.780000"),
        longitude=Decimal("-122.410000"),
        engine_temperature=Decimal("40.0"),
        battery_voltage=Decimal("12.1"),
        load_percentage=Decimal("0"),
        vibration_level=Decimal("0.5"),
        rental_status="Overdue",
    )
    tel2b = EquipmentTelemetry(
        telemetry_id=4,
        equipment_id=eq2.equipment_id,
        timestamp=now - timedelta(hours=3),
        engine_status="OFF",
        fuel_level=Decimal("40.0"),
        engine_hours=Decimal("801.0"),
        idle_hours=Decimal("210.0"),
        speed=Decimal("0"),
        latitude=Decimal("37.780000"),
        longitude=Decimal("-122.410000"),
        engine_temperature=Decimal("40.0"),
        battery_voltage=Decimal("12.1"),
        load_percentage=Decimal("0"),
        vibration_level=Decimal("0.5"),
        rental_status="Overdue",
    )
    db_session.add_all([tel1a, tel1b, tel2a, tel2b])

    alert = AnomalyAlert(
        equipment_id=str(eq1.equipment_id),
        equipment_type="Excavator",
        site_id=str(site.site_id),
        anomaly_type=AnomalyType.ENGINE_OVERHEAT,
        severity=AnomalySeverity.CRITICAL,
        description="Engine temperature critically high",
        recommendation="Shut down and inspect cooling",
        trigger_value="112C",
        threshold_value=">105C",
        is_resolved=False,
        detected_at=now - timedelta(minutes=1),
    )
    db_session.add(alert)
    db_session.commit()

    return {
        "company_id": company.company_id,
        "dealer_id": dealer.dealer_id,
        "site_id": site.site_id,
        "user_id": user.user_id,
        "equipment_ids": [eq1.equipment_id, eq2.equipment_id],
        "alert_id": alert.alert_id,
        "contract_ids": [c1.contract_id, c2.contract_id],
        "qr_codes": [eq1.qr_code, eq2.qr_code],
    }


@pytest.fixture()
def client(db_session: Session, seed_fleet):
    def _override_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_db

    # SSE producers use a separate session factory — point at test SQLite session
    from app.api.routes import live as live_routes

    live_routes.get_live_session = lambda: (db_session, False)

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    live_routes.get_live_session = live_routes.default_live_session


@pytest.fixture()
def fleet_headers(seed_fleet):
    return {
        "X-User-Role": "FLEET_MANAGER",
        "X-Company-Id": str(seed_fleet["company_id"]),
        "X-Actor-Id": "test-fleet-manager",
    }


@pytest.fixture()
def site_headers(seed_fleet):
    return {
        "X-User-Role": "SITE_MANAGER",
        "X-Company-Id": str(seed_fleet["company_id"]),
        "X-Site-Id": str(seed_fleet["site_id"]),
        "X-Actor-Id": "test-site-manager",
        "X-User-Id": str(seed_fleet["user_id"]),
    }


@pytest.fixture()
def dealer_headers(seed_fleet):
    return {
        "X-User-Role": "DEALER",
        "X-Dealer-Id": str(seed_fleet["dealer_id"]),
        "X-Actor-Id": "test-dealer",
    }
