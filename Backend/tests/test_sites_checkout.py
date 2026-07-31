"""Site Manager + QR checkout tests."""


def test_list_sites(client, site_headers, seed_fleet):
    res = client.get("/api/v1/sites", headers=site_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) >= 1
    assert any(s["siteId"] == seed_fleet["site_id"] for s in data)


def test_site_summary_and_equipment(client, site_headers, seed_fleet):
    sid = seed_fleet["site_id"]
    summary = client.get(f"/api/v1/sites/{sid}/summary", headers=site_headers)
    assert summary.status_code == 200
    assert summary.json()["data"]["activeAssignments"] >= 1
    # The assigned excavator has a critical alert, so assignment state must not
    # be mislabeled as live WORKING.
    assert summary.json()["data"]["liveWorking"] == 0

    eq = client.get(f"/api/v1/sites/{sid}/equipment", headers=site_headers)
    assert eq.status_code == 200
    assert len(eq.json()["data"]) >= 1


def test_equipment_by_qr(client, site_headers, seed_fleet):
    qr = seed_fleet["qr_codes"][0]
    res = client.get(f"/api/v1/equipment/by-qr/{qr}", headers=site_headers)
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["qrCode"] == qr
    assert "CHECK_OUT" in body["allowedActions"]


def test_checkout_scan_check_in_and_out(client, site_headers, seed_fleet):
    # Check in equipment currently active on site
    qr_active = seed_fleet["qr_codes"][0]
    cin = client.post(
        "/api/v1/checkouts/scan",
        headers=site_headers,
        json={
            "action": "CHECK_IN",
            "siteId": seed_fleet["site_id"],
            "qrCode": qr_active,
        },
    )
    assert cin.status_code == 200
    assert cin.json()["data"]["action"] == "CHECK_IN"
    assert cin.json()["data"]["assignment"]["status"] == "RETURNED"

    # Check out crane (no prior active site) onto North Pit
    qr_crane = seed_fleet["qr_codes"][1]
    cout = client.post(
        "/api/v1/checkouts/scan",
        headers=site_headers,
        json={
            "action": "CHECK_OUT",
            "siteId": seed_fleet["site_id"],
            "qrCode": qr_crane,
            "operatorId": "OP-99",
        },
    )
    assert cout.status_code == 200
    body = cout.json()["data"]
    assert body["action"] == "CHECK_OUT"
    assert body["assignment"]["status"] == "ACTIVE"
    assert body["assignment"]["siteId"] == seed_fleet["site_id"]


def test_active_checkouts(client, site_headers, seed_fleet):
    res = client.get(
        "/api/v1/checkouts/active",
        headers=site_headers,
        params={"siteId": seed_fleet["site_id"]},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_operator_roster_is_company_scoped_and_assignment_aware(
    client, site_headers, seed_fleet
):
    res = client.get("/api/v1/operators", headers=site_headers)
    assert res.status_code == 200
    rows = res.json()["data"]
    assert len(rows) == 1
    assert rows[0]["operatorId"].startswith("OP")
    assert rows[0]["availability"] == "ASSIGNED"
    assert rows[0]["equipmentName"] == "CAT 320"
    assert rows[0]["siteName"] == "North Pit"


def test_create_site(client, fleet_headers, seed_fleet):
    res = client.post(
        "/api/v1/sites",
        headers=fleet_headers,
        json={
            "siteName": "South Yard",
            "location": "37.7,-122.4",
            "companyId": seed_fleet["company_id"],
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["siteName"] == "South Yard"


def test_dealer_forbidden_from_sites(client, dealer_headers):
    res = client.get("/api/v1/sites", headers=dealer_headers)
    assert res.status_code == 403
