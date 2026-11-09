from app.models import User
from app.security import hash_password
from tests.conftest import TestingSession, test_client as client


def test_register_user():
    response = client.post(
        "/api/auth/register",
        json={"email": "newuser@example.com", "password": "supersecretpassword"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["is_active"] is True
    assert "id" in data
    assert "password" not in data
    assert "hashed_password" not in data


def test_register_duplicate_email():
    payload = {"email": "duplicate@example.com", "password": "secretpassword123"}
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = client.post("/api/auth/register", json=payload)
    assert r2.status_code == 400
    assert r2.json()["detail"] == "Email already registered"


def test_login_json_success_and_failure():
    # Register user
    client.post(
        "/api/auth/register",
        json={"email": "loginuser@example.com", "password": "correctpassword"},
    )

    # Correct login
    r_success = client.post(
        "/api/auth/login",
        json={"email": "loginuser@example.com", "password": "correctpassword"},
    )
    assert r_success.status_code == 200
    token_data = r_success.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

    # Wrong password
    r_wrong = client.post(
        "/api/auth/login",
        json={"email": "loginuser@example.com", "password": "wrongpassword"},
    )
    assert r_wrong.status_code == 401

    # Non-existent email
    r_nonexistent = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "correctpassword"},
    )
    assert r_nonexistent.status_code == 401


def test_login_oauth2_form():
    client.post(
        "/api/auth/register",
        json={"email": "formuser@example.com", "password": "formpassword123"},
    )

    r = client.post(
        "/api/auth/token",
        data={"username": "formuser@example.com", "password": "formpassword123"},
    )
    assert r.status_code == 200
    assert "access_token" in r.json()
    assert r.json()["token_type"] == "bearer"


def test_get_current_user_me_endpoint():
    # Register and login to get access token
    client.post(
        "/api/auth/register",
        json={"email": "meuser@example.com", "password": "mepassword123"},
    )
    login_res = client.post(
        "/api/auth/login",
        json={"email": "meuser@example.com", "password": "mepassword123"},
    )
    token = login_res.json()["access_token"]

    # Access /api/auth/me with valid Bearer token
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "meuser@example.com"

    # Access /api/auth/me with invalid token
    bad_res = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert bad_res.status_code == 401

    # Access without auth header
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401


def test_inactive_user_cannot_login_or_access_me():
    db = TestingSession()
    inactive_user = User(
        email="inactive@example.com",
        hashed_password=hash_password("inactivepass123"),
        is_active=False,
    )
    db.add(inactive_user)
    db.commit()
    db.close()

    # Attempt login
    login_res = client.post(
        "/api/auth/login",
        json={"email": "inactive@example.com", "password": "inactivepass123"},
    )
    assert login_res.status_code == 400
    assert login_res.json()["detail"] == "Inactive user"


def test_expired_token():
    from datetime import timedelta
    from app.security import create_access_token

    expired_token = create_access_token(
        data={"sub": "newuser@example.com"},
        expires_delta=timedelta(minutes=-10),
    )
    res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401


def test_roles_listing():
    res = client.get("/api/roles")
    assert res.status_code == 200
    roles = res.json()
    role_names = [r["name"] for r in roles]
    assert "admin" in role_names
    assert "reader" in role_names


def test_register_with_roles():
    # Register admin
    admin_res = client.post(
        "/api/auth/register",
        json={"email": "admin@example.com", "password": "adminpassword123", "role": "admin"},
    )
    assert admin_res.status_code == 201
    assert admin_res.json()["role"]["name"] == "admin"

    # Register default reader
    reader_res = client.post(
        "/api/auth/register",
        json={"email": "reader@example.com", "password": "readerpassword123"},
    )
    assert reader_res.status_code == 201
    assert reader_res.json()["role"]["name"] == "reader"

    # Register with invalid role
    invalid_res = client.post(
        "/api/auth/register",
        json={"email": "invalid@example.com", "password": "password123", "role": "superuser"},
    )
    assert invalid_res.status_code == 400
    assert "Invalid role" in invalid_res.json()["detail"]


def test_role_in_login_token_and_update_role():
    # Register admin and login
    client.post(
        "/api/auth/register",
        json={"email": "superadmin@example.com", "password": "supersecretpassword", "role": "admin"},
    )
    admin_login = client.post(
        "/api/auth/login",
        json={"email": "superadmin@example.com", "password": "supersecretpassword"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    assert admin_login.json()["role"] == "admin"

    # Register reader
    user_res = client.post(
        "/api/auth/register",
        json={"email": "simpleuser@example.com", "password": "simplepassword"},
    )
    user_id = user_res.json()["id"]
    assert user_res.json()["role"]["name"] == "reader"

    user_login = client.post(
        "/api/auth/login",
        json={"email": "simpleuser@example.com", "password": "simplepassword"},
    )
    user_token = user_login.json()["access_token"]
    assert user_login.json()["role"] == "reader"

    # Reader tries to update role (should fail with 403 Forbidden)
    forbidden_res = client.patch(
        f"/api/auth/users/{user_id}/role",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"role": "admin"},
    )
    assert forbidden_res.status_code == 403

    # Admin updates user role to admin (should succeed)
    update_res = client.patch(
        f"/api/auth/users/{user_id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "admin"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["role"]["name"] == "admin"


