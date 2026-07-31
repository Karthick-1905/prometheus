"""Stable cross-service contracts.

These definitions are intentionally independent from SQLAlchemy models so HTTP,
MQTT, workers, and persistence adapters can share them during migrations.
"""

from app.contracts.demand_repository import DemandRepository
from app.contracts.platform import (
    AssignmentState,
    ErrorEnvelope,
    PlatformError,
    SSEEventName,
    TelemetryEnvelope,
    assert_legal_assignment_transition,
)

__all__ = [
    "AssignmentState",
    "DemandRepository",
    "ErrorEnvelope",
    "PlatformError",
    "SSEEventName",
    "TelemetryEnvelope",
    "assert_legal_assignment_transition",
]
