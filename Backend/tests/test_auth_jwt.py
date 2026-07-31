"""JWT login / me / refresh tests."""

from app.security.jwt_tokens import create_access_token


def test_login_issues_jwt_and_me_works(client):
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "fm@example.com",
            "password": "demo",
            "role": "FLEET_MANAGER",
            "companyId": 1,
        },
    )
    assert login.status_code == 200
    body = login.json()
    assert body["success"] is True
    assert body["mode"] == "jwt"
    token = body["accessToken"]
    assert token

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    user = me.json()["user"]
    assert user["role"] == "FLEET_MANAGER"
    assert user["authMode"] == "jwt"
    assert user["companyId"] == 1


def test_invalid_jwt_rejected(client):
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert res.status_code == 401


def test_refresh_from_headers(client, fleet_headers):
    res = client.post("/api/v1/auth/refresh", headers=fleet_headers)
    assert res.status_code == 200
    assert res.json()["accessToken"]


def test_dealer_login_token(client, seed_fleet):
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "dealer@example.com",
            "role": "DEALER",
            "dealerId": seed_fleet["dealer_id"],
        },
    )
    assert login.status_code == 200
    token = login.json()["accessToken"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["user"]["role"] == "DEALER"
    assert me.json()["user"]["permissions"]["isDealer"] is True


def test_seeded_login_derives_company_from_email(client, db_session):
    from app.models.domain import Company, User
    from app.models.enums import UserRole

    company = Company(company_name="Second Tenant", email="tenant2@example.com")
    db_session.add(company)
    db_session.flush()
    db_session.add(
        User(
            company_id=company.company_id,
            name="Second Fleet Manager",
            email="fleet.mgr2@demo.cat",
            role=UserRole.FLEET_MANAGER,
        )
    )
    db_session.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "fleet.mgr2@demo.cat",
            "password": "demo",
            "role": "FLEET_MANAGER",
        },
    )
    assert login.status_code == 200
    assert login.json()["user"]["companyId"] == company.company_id


def test_tenant_jwt_without_company_scope_fails_closed(client):
    token = create_access_token(subject="unscoped", role="FLEET_MANAGER")
    res = client.get(
        "/api/v1/fleet/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "Company scope required for this role"
