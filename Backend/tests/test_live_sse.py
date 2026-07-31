"""SSE live stream smoke tests."""

from app.api.routes.live import _latest_geofence_coordinates


def _collect_sse_text(client, path: str, headers: dict, params: dict | None = None) -> str:
    with client.stream(
        "GET",
        path,
        headers=headers,
        params=params or {"intervalMs": 100, "maxTicks": 2},
    ) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        chunks = []
        for chunk in response.iter_text():
            chunks.append(chunk)
        return "".join(chunks)


def test_live_fleet_stream(client, fleet_headers):
    text = _collect_sse_text(client, "/api/v1/live/fleet", fleet_headers)
    assert "event: fleet.snapshot" in text or "fleet.snapshot" in text
    assert "event: heartbeat" in text or "heartbeat" in text


def test_live_logs_db_stream(client, fleet_headers):
    text = _collect_sse_text(
        client,
        "/api/v1/live/logs",
        fleet_headers,
        params={"source": "db", "intervalMs": 100, "maxTicks": 2},
    )
    assert "log.batch" in text or "heartbeat" in text


def test_live_logs_redis_stream_emits_ready(client, fleet_headers):
    # Redis may or may not be up in CI; stream.ready always fires first.
    text = _collect_sse_text(
        client,
        "/api/v1/live/logs",
        fleet_headers,
        params={"source": "redis", "maxSeconds": 5, "recentLimit": 5},
    )
    assert "stream.ready" in text


def test_live_alerts_stream(client, fleet_headers):
    text = _collect_sse_text(client, "/api/v1/live/alerts", fleet_headers)
    assert "alerts.snapshot" in text or "heartbeat" in text


def test_live_site_stream(client, site_headers, seed_fleet):
    text = _collect_sse_text(
        client,
        f"/api/v1/live/site/{seed_fleet['site_id']}",
        site_headers,
    )
    assert "site.snapshot" in text or "heartbeat" in text


def test_live_fleet_forbidden_for_dealer(client, dealer_headers):
    res = client.get(
        "/api/v1/live/fleet",
        headers=dealer_headers,
        params={"maxTicks": 1, "intervalMs": 100},
    )
    assert res.status_code == 403


def test_redis_status_endpoint(client, fleet_headers):
    res = client.get("/api/v1/live/redis/status", headers=fleet_headers)
    assert res.status_code == 200
    assert "data" in res.json()


def test_geofence_snapshot_keeps_latest_coordinate_per_machine():
    rows = _latest_geofence_coordinates(
        [
            {
                "type": "GEOFENCE_BATCH",
                "companyId": 1,
                "coordinates": [
                    {"equipmentId": "1", "status": "ACTIVE_WORKING"},
                    {"equipmentId": "2", "status": "OUTSIDE_SITE"},
                ],
            },
            {
                "type": "GEOFENCE_BATCH",
                "companyId": 1,
                "coordinates": [{"equipmentId": "1", "status": "AT_SITE_IDLE"}],
            },
            {
                "type": "GEOFENCE_BATCH",
                "companyId": 2,
                "coordinates": [{"equipmentId": "3", "status": "ACTIVE_WORKING"}],
            },
        ],
        company_id=1,
    )

    assert {row["equipmentId"] for row in rows} == {"1", "2"}
    assert next(row for row in rows if row["equipmentId"] == "1")["status"] == "ACTIVE_WORKING"
