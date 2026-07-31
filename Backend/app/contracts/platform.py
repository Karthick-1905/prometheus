"""Canonical platform contracts frozen by ADR-0001."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AssignmentState(str, Enum):
    RESERVED = "RESERVED"
    CHECKED_OUT = "CHECKED_OUT"
    CHECKED_IN = "CHECKED_IN"
    CANCELLED = "CANCELLED"


LEGAL_ASSIGNMENT_TRANSITIONS: dict[AssignmentState, frozenset[AssignmentState]] = {
    AssignmentState.RESERVED: frozenset(
        {AssignmentState.CHECKED_OUT, AssignmentState.CANCELLED}
    ),
    AssignmentState.CHECKED_OUT: frozenset({AssignmentState.CHECKED_IN}),
    AssignmentState.CHECKED_IN: frozenset(),
    AssignmentState.CANCELLED: frozenset(),
}


def assert_legal_assignment_transition(
    current: AssignmentState, target: AssignmentState
) -> None:
    if target not in LEGAL_ASSIGNMENT_TRANSITIONS[current]:
        raise ValueError(f"Illegal assignment transition: {current.value} -> {target.value}")


class TelemetryEnvelope(BaseModel):
    """Versioned identity and timing wrapper for every telemetry payload."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    event_id: UUID = Field(alias="eventId")
    external_equipment_id: str = Field(
        alias="externalEquipmentId", min_length=1, max_length=160
    )
    equipment_id: int = Field(alias="equipmentId", gt=0)
    schema_version: str = Field(alias="schemaVersion", pattern=r"^[1-9]\d*\.\d+$")
    source: str = Field(min_length=1, max_length=80)
    device_id: str = Field(alias="deviceId", min_length=1, max_length=160)
    observed_at: datetime = Field(alias="observedAt")
    received_at: datetime = Field(alias="receivedAt")
    company_id: int = Field(alias="companyId", gt=0)
    dealer_id: int = Field(alias="dealerId", gt=0)
    site_id: int | None = Field(default=None, alias="siteId", gt=0)
    payload: dict[str, Any]

    @field_validator("external_equipment_id", "source", "device_id")
    @classmethod
    def no_implicit_identifier_normalization(cls, value: str) -> str:
        if value != value.strip():
            raise ValueError("identifier must not contain leading or trailing whitespace")
        return value

    @field_validator("observed_at", "received_at")
    @classmethod
    def require_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must be timezone-aware")
        if value.utcoffset() != timezone.utc.utcoffset(value):
            raise ValueError("timestamp must be UTC")
        return value

    @model_validator(mode="after")
    def validate_timing(self) -> "TelemetryEnvelope":
        if self.received_at < self.observed_at:
            raise ValueError("receivedAt cannot be earlier than observedAt")
        return self


class PlatformError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]*$")
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str | None = Field(default=None, alias="correlationId")
    retryable: bool = False


class ErrorEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: PlatformError


class SSEEventName(str, Enum):
    TELEMETRY = "telemetry"
    FLEET_STATUS = "fleet.status"
    INCIDENT_OPENED = "incident.opened"
    INCIDENT_UPDATED = "incident.updated"
    INCIDENT_RECOVERED = "incident.recovered"
    NOTIFICATION_CREATED = "notification.created"
    HEARTBEAT = "heartbeat"
