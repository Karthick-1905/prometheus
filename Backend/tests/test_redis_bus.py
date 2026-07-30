"""Redis bus publish helpers (no Redis required — soft-fail OK)."""
from app.services.redis_bus import publish_live_event, recent_events, redis_status


def test_publish_does_not_raise_without_redis():
    ok = publish_live_event(
        {
            "type": "TELEMETRY_RECEIVED",
            "equipmentId": "99",
            "message": "unit-test event",
        }
    )
    assert isinstance(ok, bool)


def test_recent_and_status_shapes():
    status = redis_status()
    assert "ok" in status
    assert "channel" in status
    rows = recent_events(limit=5)
    assert isinstance(rows, list)
