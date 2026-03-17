from types import SimpleNamespace

from app.schemas.auth import LoginRequest, RegisterRequest
import app.routers.auth as auth_router


def test_register_success(client, monkeypatch):
    def fake_create_user(db, name, email, password):
        return {
            "_id": "mongo-1",
            "uid": "user-123",
            "name": name,
            "email": email,
        }

    monkeypatch.setattr(auth_router, "create_user", fake_create_user)

    payload = {
        **RegisterRequest.model_validate(
            {
                "name": "Joey",
                "email": "joey@example.com",
                "password": "StrongPass123!",
            }
        ).model_dump()
    }

    res = client.post("/auth/register", json=payload)

    assert res.status_code == 201
    body = res.json()
    assert body["uid"] == "user-123"
    assert body["name"] == "Joey"
    assert body["email"] == "joey@example.com"


def test_register_conflict_when_email_in_use(client, monkeypatch):
    def fake_create_user(db, name, email, password):
        raise ValueError("EMAIL_IN_USE")

    monkeypatch.setattr(auth_router, "create_user", fake_create_user)

    payload = RegisterRequest(
        name="Joey",
        email="joey@example.com",
        password="StrongPass123!",
    ).model_dump()

    res = client.post("/auth/register", json=payload)

    assert res.status_code == 409
    assert res.json()["detail"] == "Email is already registered"


def test_login_success_and_me_success(client, monkeypatch):
    fake_user = {
        "_id": "mongo-1",
        "uid": "user-123",
        "name": "Joey",
        "email": "joey@example.com",
    }

    monkeypatch.setattr(
        auth_router, "authenticate_user", lambda db, email, password: fake_user
    )
    monkeypatch.setattr(
        auth_router,
        "db",
        SimpleNamespace(
            users=SimpleNamespace(find_one=lambda query: fake_user),
        ),
    )

    payload = LoginRequest(
        email="joey@example.com",
        password="StrongPass123!",
    ).model_dump()

    login_res = client.post("/auth/login", json=payload)
    assert login_res.status_code == 200
    assert login_res.json()["uid"] == "user-123"

    me_res = client.get("/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "joey@example.com"


def test_login_invalid_credentials_returns_401(client, monkeypatch):
    monkeypatch.setattr(
        auth_router, "authenticate_user", lambda db, email, password: None
    )

    payload = LoginRequest(
        email="joey@example.com",
        password="wrong-pass",
    ).model_dump()

    res = client.post("/auth/login", json=payload)

    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_logout_clears_session(client, monkeypatch):
    fake_user = {
        "_id": "mongo-1",
        "uid": "user-123",
        "name": "Joey",
        "email": "joey@example.com",
    }

    monkeypatch.setattr(
        auth_router, "authenticate_user", lambda db, email, password: fake_user
    )
    monkeypatch.setattr(
        auth_router,
        "db",
        SimpleNamespace(
            users=SimpleNamespace(find_one=lambda query: fake_user),
        ),
    )

    client.post(
        "/auth/login",
        json=LoginRequest(
            email="joey@example.com", password="StrongPass123!"
        ).model_dump(),
    )

    logout_res = client.post("/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json() == {"ok": True}

    me_res = client.get("/auth/me")
    assert me_res.status_code == 401
    assert me_res.json()["detail"] == "Not authenticated"


def test_me_invalid_session_clears_and_returns_401(client, monkeypatch):
    fake_user = {
        "_id": "mongo-1",
        "uid": "user-123",
        "name": "Joey",
        "email": "joey@example.com",
    }

    monkeypatch.setattr(
        auth_router, "authenticate_user", lambda db, email, password: fake_user
    )
    monkeypatch.setattr(
        auth_router,
        "db",
        SimpleNamespace(
            users=SimpleNamespace(find_one=lambda query: None),
        ),
    )

    client.post(
        "/auth/login",
        json=LoginRequest(
            email="joey@example.com", password="StrongPass123!"
        ).model_dump(),
    )

    res = client.get("/auth/me")

    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid session"
