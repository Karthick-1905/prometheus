"""Rental / site booking notifications and contract extend."""


def test_scan_creates_ending_soon_and_overdue(client, fleet_headers, seed_fleet):
    res = client.post(
        "/api/v1/notifications/scan",
        headers=fleet_headers,
        params={"endingSoonDays": 14, "sendEmail": True},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["created"]["endingSoon"] + data["created"]["overdue"] >= 1

    listed = client.get("/api/v1/notifications", headers=fleet_headers)
    assert listed.status_code == 200
    rows = listed.json()["data"]
    assert len(rows) >= 1
    types = {r["type"] for r in rows}
    assert types & {"RENTAL_ENDING_SOON", "RENTAL_OVERDUE"}
    # Email without SMTP is logged
    assert any(r["emailStatus"] in {"SENT_LOG", "SKIPPED", "SENT", "PENDING"} for r in rows)


def test_scan_is_idempotent(client, fleet_headers):
    client.post("/api/v1/notifications/scan", headers=fleet_headers, params={"endingSoonDays": 14})
    first = client.get("/api/v1/notifications", headers=fleet_headers).json()["meta"]["total"]
    client.post("/api/v1/notifications/scan", headers=fleet_headers, params={"endingSoonDays": 14})
    second = client.get("/api/v1/notifications", headers=fleet_headers).json()["meta"]["total"]
    assert first == second


def test_mark_read_and_unread_count(client, fleet_headers):
    client.post("/api/v1/notifications/scan", headers=fleet_headers, params={"endingSoonDays": 14})
    listed = client.get("/api/v1/notifications", headers=fleet_headers).json()
    assert listed["meta"]["unread"] >= 1
    nid = listed["data"][0]["notificationId"]
    read = client.post(f"/api/v1/notifications/{nid}/read", headers=fleet_headers)
    assert read.status_code == 200
    assert read.json()["data"]["isRead"] is True
    count = client.get("/api/v1/notifications/unread-count", headers=fleet_headers)
    assert count.status_code == 200
    assert count.json()["data"]["unread"] < listed["meta"]["unread"]


def test_extend_contract(client, fleet_headers, seed_fleet):
    od = client.get("/api/v1/contracts/overdue", headers=fleet_headers).json()["data"]
    assert len(od) >= 1
    contract_id = od[0]["contractId"]
    res = client.post(
        f"/api/v1/contracts/{contract_id}/extend",
        headers=fleet_headers,
        json={"extraDays": 7},
    )
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["extraDays"] == 7
    assert body["rentalStatus"] == "ACTIVE"
    assert body["expectedReturn"]


def test_site_booking_notification(client, fleet_headers, seed_fleet, site_headers):
    # Use fleet company equipment assignment via site headers
    unassigned = client.get("/api/v1/fleet/unassigned", headers=fleet_headers)
    # create assignment for active contract on seed site
    contracts = client.get(
        "/api/v1/contracts/expiring",
        headers=fleet_headers,
        params={"days": 30},
    )
    # Prefer overdue/active from seed — seed has assignment already; create on other contract if any
    # Seed excavator already assigned; create_assignment for crane if available
    equipment_ids = seed_fleet["equipment_ids"]
    # find contract for equipment via machines list
    machines = client.get("/api/v1/fleet/machines", headers=fleet_headers).json()["data"]
    assert machines
    contract_id = machines[0]["contractId"]
    site_id = seed_fleet["site_id"]
    res = client.post(
        "/api/v1/assignments",
        headers={**fleet_headers, "X-User-Id": str(seed_fleet["user_id"])},
        json={"contractId": contract_id, "siteId": site_id},
    )
    assert res.status_code == 200, res.text
    notes = client.get("/api/v1/notifications", headers=fleet_headers).json()["data"]
    assert any(n["type"] == "SITE_BOOKED" for n in notes)
