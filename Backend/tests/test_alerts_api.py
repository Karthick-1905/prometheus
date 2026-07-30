"""Alert route tests (legacy + v1)."""
from __future__ import annotations


def test_list_alerts_legacy(client, seed_fleet):
    res = client.get("/api/alerts", params={"resolved": False})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert len(body["alerts"]) >= 1
    assert body["alerts"][0]["severity"] == "CRITICAL"


def test_alerts_summary(client, seed_fleet):
    res = client.get("/api/v1/alerts/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["open"] >= 1
    assert body["critical"] >= 1


def test_resolve_alert_v1(client, seed_fleet):
    alert_id = seed_fleet["alert_id"]
    res = client.post(f"/api/v1/alerts/{alert_id}/resolve")
    assert res.status_code == 200
    assert res.json()["data"]["isResolved"] is True

    listed = client.get("/api/v1/alerts", params={"resolved": False})
    open_ids = {a["alertId"] for a in listed.json()["data"]}
    assert alert_id not in open_ids


def test_resolve_alert_legacy_patch(client, seed_fleet, db_session):
    # re-open style: create second unresolved by using seed after resolve tests
    # if already resolved from previous test order, re-seed not needed — create new
    from datetime import datetime

    from app.models.domain import AnomalyAlert
    from app.models.enums import AnomalySeverity, AnomalyType

    a = AnomalyAlert(
        equipment_id=str(seed_fleet["equipment_ids"][0]),
        equipment_type="Excavator",
        anomaly_type=AnomalyType.LOW_BATTERY,
        severity=AnomalySeverity.WARNING,
        description="Low battery",
        recommendation="Charge",
        is_resolved=False,
        detected_at=datetime.utcnow(),
    )
    db_session.add(a)
    db_session.commit()
    db_session.refresh(a)

    res = client.patch("/api/alerts", json={"alertId": a.alert_id})
    assert res.status_code == 200
    assert res.json()["alert"]["isResolved"] is True


def test_get_alert_not_found(client):
    res = client.get("/api/v1/alerts/999999")
    assert res.status_code == 404
