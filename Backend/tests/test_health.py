"""System health / root smoke tests."""


def test_root_lists_fleet_endpoints(client):
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert "fleet_overview" in body["endpoints"]
    assert body["endpoints"]["demand"] == "GET /api/demand/status"


def test_health_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "demand_forecasting" in body
