"""Alert route tests (legacy + v1)."""
from __future__ import annotations


def _add_other_company_alert(db_session, seed_fleet):
    from datetime import datetime

    from app.models.domain import AnomalyAlert, Company, Equipment, RentalContract
    from app.models.enums import (
        AnomalySeverity,
        AnomalyType,
        EquipmentStatus,
        RentalContractStatus,
    )

    company = Company(company_name="Other Tenant", email="other@example.com")
    equipment = Equipment(
        dealer_id=seed_fleet["dealer_id"],
        equipment_name="Other Tenant Dozer",
        equipment_type="Bulldozer",
        status=EquipmentStatus.RENTED,
    )
    db_session.add_all([company, equipment])
    db_session.flush()
    db_session.add(
        RentalContract(
            dealer_id=seed_fleet["dealer_id"],
            company_id=company.company_id,
            equipment_id=equipment.equipment_id,
            rental_status=RentalContractStatus.ACTIVE,
        )
    )
    alert = AnomalyAlert(
        company_id=company.company_id,
        equipment_id=str(equipment.equipment_id),
        equipment_type=equipment.equipment_type,
        anomaly_type=AnomalyType.LOW_BATTERY,
        severity=AnomalySeverity.WARNING,
        description="Other tenant alert",
        recommendation="Inspect other tenant equipment",
        is_resolved=False,
        detected_at=datetime.utcnow(),
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)
    return company.company_id, equipment.equipment_id, alert.alert_id


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
        company_id=seed_fleet["company_id"],
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


def test_alert_routes_and_live_logs_exclude_other_tenants(
    client, fleet_headers, seed_fleet, db_session
):
    _, other_equipment_id, other_alert_id = _add_other_company_alert(
        db_session, seed_fleet
    )

    listed = client.get("/api/v1/alerts", headers=fleet_headers).json()["data"]
    assert str(other_equipment_id) not in {row["equipmentId"] for row in listed}

    legacy = client.get("/api/alerts", headers=fleet_headers).json()["alerts"]
    assert str(other_equipment_id) not in {row["equipmentId"] for row in legacy}

    assert (
        client.get(f"/api/v1/alerts/{other_alert_id}", headers=fleet_headers).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/alerts/{other_alert_id}/resolve", headers=fleet_headers
        ).status_code
        == 404
    )

    logs = client.get("/api/v1/fleet/logs", headers=fleet_headers).json()["data"]
    assert str(other_equipment_id) not in {
        str(row["equipmentId"]) for row in logs if row["type"].startswith("ALERT")
    }


def test_detected_alert_persists_contract_company(db_session, seed_fleet):
    from app.services.anomaly_detection.service import AnomalyDetectionService

    alerts = AnomalyDetectionService.detect_and_record(
        db_session,
        {
            "equipmentId": seed_fleet["equipment_ids"][0],
            "equipmentType": "Excavator",
            "engineStatus": "ON",
            "operatorId": "OP001",
            "latitude": 37.77,
            "longitude": -122.42,
            "engineTemperature": 110,
            "batteryVoltage": 13.0,
        },
    )
    assert alerts
    assert {alert.company_id for alert in alerts} == {seed_fleet["company_id"]}
