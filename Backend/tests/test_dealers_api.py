"""Dealer inventory + contract API tests."""
from datetime import datetime, timedelta


def test_dealer_me_and_summary(client, dealer_headers, seed_fleet):
    me = client.get("/api/v1/dealers/me", headers=dealer_headers)
    assert me.status_code == 200
    assert me.json()["data"]["dealerId"] == seed_fleet["dealer_id"]

    summary = client.get("/api/v1/dealers/me/summary", headers=dealer_headers)
    assert summary.status_code == 200
    totals = summary.json()["data"]["totals"]
    assert totals["equipment"] >= 2
    assert totals["rented"] >= 1


def test_list_and_create_equipment(client, dealer_headers):
    listed = client.get("/api/v1/dealers/equipment", headers=dealer_headers)
    assert listed.status_code == 200
    before = listed.json()["meta"]["total"]

    created = client.post(
        "/api/v1/dealers/equipment",
        headers=dealer_headers,
        json={
            "equipmentName": "CAT D6",
            "equipmentType": "Bulldozer",
            "dailyRentalCost": 450.0,
            "status": "AVAILABLE",
        },
    )
    assert created.status_code == 200
    eq = created.json()["data"]
    assert eq["status"] == "AVAILABLE"
    assert eq["qrCode"]
    assert eq["equipmentType"] == "Bulldozer"

    listed2 = client.get("/api/v1/dealers/equipment", headers=dealer_headers)
    assert listed2.json()["meta"]["total"] == before + 1


def test_rotate_qr(client, dealer_headers, seed_fleet):
    eq_id = seed_fleet["equipment_ids"][0]
    before = client.get(
        f"/api/v1/dealers/equipment/{eq_id}", headers=dealer_headers
    ).json()["data"]["qrCode"]
    rotated = client.post(
        f"/api/v1/dealers/equipment/{eq_id}/qr", headers=dealer_headers
    )
    assert rotated.status_code == 200
    assert rotated.json()["data"]["qrCode"] != before


def test_create_and_complete_contract(client, dealer_headers, seed_fleet):
    # Register available unit then rent it
    created = client.post(
        "/api/v1/dealers/equipment",
        headers=dealer_headers,
        json={
            "equipmentName": "Spare Excavator",
            "equipmentType": "Excavator",
            "status": "AVAILABLE",
        },
    )
    eq_id = created.json()["data"]["equipmentId"]
    now = datetime.utcnow()
    contract = client.post(
        "/api/v1/dealers/contracts",
        headers=dealer_headers,
        json={
            "companyId": seed_fleet["company_id"],
            "equipmentId": eq_id,
            "rentalStart": now.isoformat(),
            "expectedReturn": (now + timedelta(days=14)).isoformat(),
        },
    )
    assert contract.status_code == 200
    cid = contract.json()["data"]["contractId"]
    assert contract.json()["data"]["rentalStatus"] == "ACTIVE"

    done = client.post(
        f"/api/v1/dealers/contracts/{cid}/complete",
        headers=dealer_headers,
    )
    assert done.status_code == 200
    assert done.json()["data"]["rentalStatus"] == "COMPLETED"

    eq = client.get(f"/api/v1/dealers/equipment/{eq_id}", headers=dealer_headers)
    assert eq.json()["data"]["status"] == "AVAILABLE"


def test_fleet_manager_forbidden_from_dealer(client, fleet_headers):
    res = client.get("/api/v1/dealers/equipment", headers=fleet_headers)
    assert res.status_code == 403


def test_list_contracts(client, dealer_headers):
    res = client.get("/api/v1/dealers/contracts", headers=dealer_headers)
    assert res.status_code == 200
    assert res.json()["meta"]["total"] >= 1
