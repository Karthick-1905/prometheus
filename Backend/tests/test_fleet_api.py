"""Fleet Manager Phase 1 route tests (SQLite seeded fleet)."""
from __future__ import annotations


def test_auth_me_defaults_to_fleet_manager(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["user"]["role"] == "FLEET_MANAGER"
    assert body["user"]["permissions"]["isFleetManager"] is True


def test_auth_me_rejects_unknown_role(client):
    res = client.get("/api/v1/auth/me", headers={"X-User-Role": "SPACE_RANGER"})
    assert res.status_code == 403


def test_fleet_overview(client, fleet_headers, seed_fleet):
    res = client.get("/api/v1/fleet/overview", headers=fleet_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["totals"]["machinesRented"] == 2
    assert body["totals"]["overdue"] >= 1
    assert body["criticalAlerts"] >= 1


def test_fleet_machines_list_and_filters(client, fleet_headers):
    res = client.get("/api/v1/fleet/machines", headers=fleet_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 2
    assert {m["equipmentType"] for m in data} >= {"Excavator", "Crane"}

    excavators = client.get(
        "/api/v1/fleet/machines",
        headers=fleet_headers,
        params={"equipmentType": "Excavator"},
    )
    assert excavators.status_code == 200
    assert all(m["equipmentType"] == "Excavator" for m in excavators.json()["data"])

    overdue = client.get(
        "/api/v1/fleet/machines",
        headers=fleet_headers,
        params={"rentalStatus": "OVERDUE"},
    )
    assert overdue.status_code == 200
    assert len(overdue.json()["data"]) == 1
    assert overdue.json()["data"][0]["liveStatus"] == "OVERDUE"


def test_fleet_machine_detail_and_telemetry(client, fleet_headers, seed_fleet):
    eq_id = seed_fleet["equipment_ids"][0]
    detail = client.get(f"/api/v1/fleet/machines/{eq_id}", headers=fleet_headers)
    assert detail.status_code == 200
    body = detail.json()["data"]
    assert body["equipmentId"] == eq_id
    assert body["operatorId"].startswith("OP")
    assert body["telemetry"] is not None
    assert body["liveStatus"] in {
        "WORKING",
        "IDLE",
        "ALERT",
        "OFF",
        "STALE",
        "OVERDUE",
        "IN_TRANSIT",
    }
    # critical open alert should elevate status to ALERT (unless other priority)
    assert body["openAlertCount"] >= 1
    assert body["liveStatus"] == "ALERT"

    tel = client.get(
        f"/api/v1/fleet/machines/{eq_id}/telemetry",
        headers=fleet_headers,
    )
    assert tel.status_code == 200
    assert len(tel.json()["data"]) >= 1


def test_fleet_map_and_sites_and_logs(client, fleet_headers):
    m = client.get("/api/v1/fleet/map", headers=fleet_headers)
    assert m.status_code == 200
    assert len(m.json()["data"]) >= 1
    assert "latitude" in m.json()["data"][0]

    sites = client.get("/api/v1/fleet/sites", headers=fleet_headers)
    assert sites.status_code == 200
    assert len(sites.json()["data"]) >= 1

    logs = client.get("/api/v1/fleet/logs", headers=fleet_headers)
    assert logs.status_code == 200
    assert len(logs.json()["data"]) >= 1


def test_fleet_unassigned_includes_overdue_without_site(client, fleet_headers):
    res = client.get("/api/v1/fleet/unassigned", headers=fleet_headers)
    assert res.status_code == 200
    # Crane has no active site assignment
    assert any(m["equipmentType"] == "Crane" for m in res.json()["data"])


def test_contracts_expiring_and_overdue(client, fleet_headers):
    exp = client.get("/api/v1/contracts/expiring", headers=fleet_headers, params={"days": 14})
    assert exp.status_code == 200
    assert exp.json()["meta"]["total"] >= 1

    od = client.get("/api/v1/contracts/overdue", headers=fleet_headers)
    assert od.status_code == 200
    assert od.json()["meta"]["total"] >= 1


def test_dealer_role_forbidden_from_fleet(client):
    res = client.get(
        "/api/v1/fleet/overview",
        headers={"X-User-Role": "DEALER", "X-Dealer-Id": "1"},
    )
    assert res.status_code == 403


def test_machine_not_found(client, fleet_headers):
    res = client.get("/api/v1/fleet/machines/99999", headers=fleet_headers)
    assert res.status_code == 404
