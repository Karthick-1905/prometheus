"""Analytics usage / utilization dashboard routes."""


def test_usage_summary(client, fleet_headers):
    res = client.get(
        "/api/v1/analytics/usage/summary",
        headers=fleet_headers,
        params={"days": 7},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["machineCount"] == 2
    # eq1 usage logs: 28+22 runtime, 12+18 idle
    assert data["totalRuntimeHours"] >= 50.0
    assert data["totalIdleHours"] >= 30.0
    assert data["totalFuelConsumed"] >= 300.0
    assert 0 <= data["utilizationPct"] <= 100
    assert "avgIdleRatio" in data


def test_usage_by_site(client, fleet_headers, seed_fleet):
    res = client.get("/api/v1/analytics/usage/by-site", headers=fleet_headers)
    assert res.status_code == 200
    rows = res.json()["data"]
    assert len(rows) >= 1
    # North Pit should have excavator with usage logs
    north = next(
        (r for r in rows if r.get("siteId") == seed_fleet["site_id"]),
        None,
    )
    assert north is not None
    assert north["runtimeHours"] >= 50.0
    assert "utilizationPct" in north


def test_usage_by_equipment(client, fleet_headers, seed_fleet):
    res = client.get("/api/v1/analytics/usage/by-equipment", headers=fleet_headers)
    assert res.status_code == 200
    rows = res.json()["data"]
    assert len(rows) == 2
    by_id = {r["equipmentId"]: r for r in rows}
    eq1 = by_id[seed_fleet["equipment_ids"][0]]
    assert eq1["source"] == "usage_log"
    assert eq1["runtimeHours"] == 50.0
    assert eq1["idleHours"] == 30.0
    assert eq1["utilizationPct"] == 62.5  # 50/(50+30)

    eq2 = by_id[seed_fleet["equipment_ids"][1]]
    assert eq2["source"] == "telemetry"
    # engine 800→801, idle 190→210 → runtime 1, idle 20
    assert eq2["runtimeHours"] == 1.0
    assert eq2["idleHours"] == 20.0


def test_usage_by_type(client, fleet_headers):
    res = client.get("/api/v1/analytics/usage/by-type", headers=fleet_headers)
    assert res.status_code == 200
    rows = res.json()["data"]
    types = {r["equipmentType"] for r in rows}
    assert "Excavator" in types
    assert "Crane" in types


def test_utilization(client, fleet_headers):
    res = client.get(
        "/api/v1/analytics/utilization",
        headers=fleet_headers,
        params={"days": 7},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["machineCount"] == 2
    assert data["fleetUtilizationPct"] > 0
    assert len(data["machines"]) == 2
    # sorted ascending utilization — crane should be first (lower util)
    assert data["machines"][0]["utilizationPct"] <= data["machines"][-1]["utilizationPct"]


def test_underutilized_flags_crane(client, fleet_headers, seed_fleet):
    res = client.get(
        "/api/v1/analytics/underutilized",
        headers=fleet_headers,
        params={"days": 7, "threshold": 0.35},
    )
    assert res.status_code == 200
    rows = res.json()["data"]
    # crane util = 1/21 ≈ 4.8% < 35%
    crane_id = seed_fleet["equipment_ids"][1]
    assert any(r["equipmentId"] == crane_id for r in rows)
    assert res.json()["meta"]["thresholdPct"] == 35.0


def test_underutilized_high_threshold_includes_more(client, fleet_headers):
    res = client.get(
        "/api/v1/analytics/underutilized",
        headers=fleet_headers,
        params={"threshold": 0.9},
    )
    assert res.status_code == 200
    # excavator 62.5% and crane ~4.8% both under 90%
    assert len(res.json()["data"]) == 2


def test_dealer_forbidden(client, dealer_headers):
    res = client.get("/api/v1/analytics/usage/summary", headers=dealer_headers)
    assert res.status_code == 403


def test_site_manager_allowed(client, site_headers):
    res = client.get("/api/v1/analytics/utilization", headers=site_headers)
    assert res.status_code == 200
