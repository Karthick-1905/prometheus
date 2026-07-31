from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.contracts.platform import (
    AssignmentState,
    TelemetryEnvelope,
    assert_legal_assignment_transition,
)


def _envelope(**overrides):
    now = datetime.now(timezone.utc)
    values = {
        "eventId": uuid4(),
        "externalEquipmentId": "CAT-0001-A",
        "equipmentId": 1,
        "schemaVersion": "1.0",
        "source": "mqtt",
        "deviceId": "gateway-1",
        "observedAt": now,
        "receivedAt": now + timedelta(milliseconds=5),
        "companyId": 1,
        "dealerId": 1,
        "siteId": 1,
        "payload": {"engineHours": 10.5},
    }
    values.update(overrides)
    return values


def test_telemetry_envelope_preserves_exact_external_identifier():
    envelope = TelemetryEnvelope.model_validate(_envelope())
    assert envelope.external_equipment_id == "CAT-0001-A"


@pytest.mark.parametrize(
    "field,value",
    [
        ("externalEquipmentId", " CAT-0001-A"),
        ("observedAt", datetime.utcnow()),
        ("schemaVersion", "latest"),
    ],
)
def test_telemetry_envelope_rejects_ambiguous_contract_values(field, value):
    with pytest.raises(ValidationError):
        TelemetryEnvelope.model_validate(_envelope(**{field: value}))


def test_telemetry_envelope_rejects_received_before_observed():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        TelemetryEnvelope.model_validate(
            _envelope(observedAt=now, receivedAt=now - timedelta(seconds=1))
        )


def test_assignment_transition_contract():
    assert_legal_assignment_transition(
        AssignmentState.RESERVED, AssignmentState.CHECKED_OUT
    )
    with pytest.raises(ValueError, match="CHECKED_OUT -> CANCELLED"):
        assert_legal_assignment_transition(
            AssignmentState.CHECKED_OUT, AssignmentState.CANCELLED
        )
