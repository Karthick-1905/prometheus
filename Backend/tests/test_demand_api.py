from fastapi.testclient import TestClient

from app.main import app
from app.security.jwt_tokens import create_access_token

client = TestClient(app)


def test_customer_forecast_and_package_contracts():
    projects = client.get("/api/demand/projects")
    assert projects.status_code == 200
    assert len(projects.json()["projects"]) >= 5

    forecast = client.get("/api/demand/projects/1/equipment/Excavator")
    assert forecast.status_code == 200
    payload = forecast.json()
    assert len(payload["forecast"]) == 4
    assert payload["dataMode"] == "synthetic"
    assert payload["pricingMode"] == "simulated"

    packages = client.get(
        "/api/demand/projects/1/packages",
        params={"equipmentType": "Excavator", "preference": "BALANCED"},
    )
    assert packages.status_code == 200
    assert packages.json()["recommendation"]["alternatives"]


def test_customer_cannot_open_dealer_view():
    response = client.get("/api/demand/dealer")
    assert response.status_code == 403


def test_model_metrics_require_admin_and_expose_serving_evidence():
    assert client.get("/api/demand/metrics").status_code == 403
    response = client.get(
        "/api/demand/metrics",
        headers={"X-User-Role": "SYSTEM_ADMINISTRATOR"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["metrics"]["verificationStatus"] == "SYNTHETIC_ENGINEERING_EVIDENCE_ONLY"
    assert payload["servingMethods"]["units"]
    assert payload["servingMethods"]["machineHours"]


def test_dealer_view_and_idempotent_action_decision():
    headers = {
        "X-Actor-Id": "test-fleet",
        "X-User-Role": "FLEET_MANAGER",
        "X-Dealer-Id": "1",
    }
    result = client.get("/api/demand/dealer", headers=headers)
    assert result.status_code == 200
    action = result.json()["actions"][0]
    decision_headers = {**headers, "Idempotency-Key": "test-dealer-action-0001"}
    body = {
        "decision": "APPROVED",
        "expectedVersion": 1,
        "reason": "Verified source buffer and destination lead time.",
    }
    first = client.post(
        f"/api/demand/dealer/actions/{action['actionId']}/decision",
        headers=decision_headers,
        json=body,
    )
    second = client.post(
        f"/api/demand/dealer/actions/{action['actionId']}/decision",
        headers=decision_headers,
        json=body,
    )
    assert first.status_code == 200
    assert second.json() == first.json()


def test_override_requires_version_and_is_idempotent():
    forecast = client.get("/api/demand/projects/1/equipment/Excavator").json()["forecast"][0]
    headers = {"Idempotency-Key": "test-forecast-override-0001"}
    body = {
        "forecastId": forecast["forecastId"],
        "expectedVersion": forecast["version"],
        "adjustedUnits": 1.5,
        "adjustedMachineHours": 70,
        "reason": "Site manager confirmed a smaller excavation workfront.",
    }
    first = client.post("/api/demand/override", headers=headers, json=body)
    second = client.post("/api/demand/override", headers=headers, json=body)
    assert first.status_code == 200
    assert second.json() == first.json()


def test_dashboard_customer_jwt_is_accepted_and_tenant_scoped():
    tenant_one = create_access_token(
        subject="fleet-manager-1",
        role="FLEET_MANAGER",
        company_id=1,
    )
    allowed = client.get(
        "/api/demand/projects/1",
        headers={"Authorization": f"Bearer {tenant_one}"},
    )
    assert allowed.status_code == 200

    tenant_two = create_access_token(
        subject="fleet-manager-2",
        role="FLEET_MANAGER",
        company_id=2,
    )
    denied = client.get(
        "/api/demand/projects/1",
        headers={"Authorization": f"Bearer {tenant_two}"},
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "Project is outside your customer scope"


def test_dashboard_dealer_jwt_is_accepted_and_requires_dealer_scope():
    scoped = create_access_token(
        subject="dealer-1",
        role="DEALER",
        dealer_id=1,
    )
    allowed = client.get(
        "/api/demand/dealer",
        headers={"Authorization": f"Bearer {scoped}"},
    )
    assert allowed.status_code == 200

    unscoped = create_access_token(subject="dealer-unscoped", role="DEALER")
    denied = client.get(
        "/api/demand/dealer",
        headers={"Authorization": f"Bearer {unscoped}"},
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "Dealer scope required for this role"


def test_customer_jwt_without_company_scope_fails_closed():
    token = create_access_token(subject="fleet-unscoped", role="FLEET_MANAGER")
    response = client.get(
        "/api/demand/projects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Company scope required for this role"


def test_production_rejects_demo_headers_but_accepts_bearer(monkeypatch):
    from app.security import demand_access

    class ProductionSettings:
        is_production = True
        demand_demo_auth_enabled = True

    monkeypatch.setattr(demand_access, "get_settings", lambda: ProductionSettings())

    headers_only = client.get(
        "/api/demand/projects",
        headers={"X-User-Role": "CUSTOMER_PROJECT_MANAGER", "X-Company-Id": "1"},
    )
    assert headers_only.status_code == 401
    assert headers_only.json()["detail"] == "Authorization Bearer token required"

    token = create_access_token(
        subject="production-fleet",
        role="FLEET_MANAGER",
        company_id=1,
    )
    bearer = client.get(
        "/api/demand/projects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bearer.status_code == 200
