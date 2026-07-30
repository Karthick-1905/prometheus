"""Unit tests for live status derivation (no DB)."""
from datetime import datetime, timedelta

from app.models.enums import EquipmentStatus, RentalContractStatus
from app.services.fleet.live_status import derive_live_status


def test_overdue_beats_working():
    now = datetime.utcnow()
    status = derive_live_status(
        equipment_status=EquipmentStatus.RENTED,
        rental_status=RentalContractStatus.OVERDUE,
        engine_status="ON",
        speed=5.0,
        load_percentage=50.0,
        last_seen_at=now,
        open_alert_count=0,
        highest_severity=None,
        now=now,
    )
    assert status == "OVERDUE"


def test_critical_alert_elevates():
    now = datetime.utcnow()
    status = derive_live_status(
        equipment_status=EquipmentStatus.RENTED,
        rental_status=RentalContractStatus.ACTIVE,
        engine_status="ON",
        speed=2.0,
        load_percentage=40.0,
        last_seen_at=now,
        open_alert_count=1,
        highest_severity="CRITICAL",
        now=now,
    )
    assert status == "ALERT"


def test_stale_when_no_recent_telemetry():
    now = datetime.utcnow()
    status = derive_live_status(
        equipment_status=EquipmentStatus.RENTED,
        rental_status=RentalContractStatus.ACTIVE,
        engine_status="ON",
        speed=2.0,
        load_percentage=40.0,
        last_seen_at=now - timedelta(hours=2),
        open_alert_count=0,
        highest_severity=None,
        now=now,
    )
    assert status == "STALE"


def test_working_and_idle():
    now = datetime.utcnow()
    working = derive_live_status(
        equipment_status=EquipmentStatus.RENTED,
        rental_status=RentalContractStatus.ACTIVE,
        engine_status="ON",
        speed=3.0,
        load_percentage=50.0,
        last_seen_at=now,
        open_alert_count=0,
        highest_severity=None,
        now=now,
    )
    idle = derive_live_status(
        equipment_status=EquipmentStatus.RENTED,
        rental_status=RentalContractStatus.ACTIVE,
        engine_status="ON",
        speed=0.0,
        load_percentage=5.0,
        last_seen_at=now,
        open_alert_count=0,
        highest_severity=None,
        now=now,
    )
    assert working == "WORKING"
    assert idle == "IDLE"
