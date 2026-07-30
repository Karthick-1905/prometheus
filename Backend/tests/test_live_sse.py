"""SSE live stream smoke tests."""


def _collect_sse_text(client, path: str, headers: dict) -> str:
    with client.stream(
        "GET",
        path,
        headers=headers,
        params={"intervalMs": 100, "maxTicks": 2},
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


def test_live_logs_stream(client, fleet_headers):
    text = _collect_sse_text(client, "/api/v1/live/logs", fleet_headers)
    assert "log.batch" in text or "heartbeat" in text


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
