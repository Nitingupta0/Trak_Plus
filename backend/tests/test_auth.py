"""Auth suite (todos.md Phase 2): expired / malformed / missing / valid tokens,
register, login, refresh, Google exchange."""

from datetime import UTC, datetime, timedelta

import jwt as pyjwt

from app.core.config import get_settings
from app.core.security import (
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

PASSWORD = "supersecret123"


async def _register(api_client, email: str) -> dict:
    resp = await api_client.post("/auth/register", json={"email": email, "password": PASSWORD})
    return resp


def _make_token(sub: str, token_type: str, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    return pyjwt.encode(
        {"sub": sub, "type": token_type, "iat": now, "exp": now + expires_delta},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


# --- password hashing ---


def test_hash_and_verify_password():
    hashed = hash_password(PASSWORD)
    assert hashed != PASSWORD
    assert verify_password(PASSWORD, hashed)
    assert not verify_password("wrong", hashed)


def test_token_type_claim_enforced():
    refresh = create_refresh_token("11111111-1111-1111-1111-111111111111")
    assert decode_token(refresh, "refresh")["sub"] == "11111111-1111-1111-1111-111111111111"
    try:
        decode_token(refresh, "access")
        raise AssertionError("refresh token must not decode as access token")
    except pyjwt.InvalidTokenError:
        pass


# --- register ---


async def test_register_creates_user(api_client):
    resp = await _register(api_client, "new-user@test.dev")
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "new-user@test.dev"
    assert "hashed_password" not in body  # never leaked
    assert "id" in body


async def test_register_duplicate_email_409(api_client):
    await _register(api_client, "dupe@test.dev")
    resp = await _register(api_client, "dupe@test.dev")
    assert resp.status_code == 409


async def test_register_weak_password_422(api_client):
    resp = await api_client.post(
        "/auth/register", json={"email": "weak@test.dev", "password": "short"}
    )
    assert resp.status_code == 422


async def test_register_invalid_email_422(api_client):
    resp = await api_client.post(
        "/auth/register", json={"email": "not-an-email", "password": PASSWORD}
    )
    assert resp.status_code == 422


# --- login ---


async def test_login_returns_tokens(api_client):
    await _register(api_client, "login@test.dev")
    resp = await api_client.post(
        "/auth/login", data={"username": "login@test.dev", "password": PASSWORD}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]


async def test_login_wrong_password_401(api_client):
    await _register(api_client, "wrongpw@test.dev")
    resp = await api_client.post(
        "/auth/login", data={"username": "wrongpw@test.dev", "password": "wrong-password"}
    )
    assert resp.status_code == 401


async def test_login_unknown_email_401(api_client):
    resp = await api_client.post(
        "/auth/login", data={"username": "ghost@test.dev", "password": PASSWORD}
    )
    assert resp.status_code == 401


# --- /auth/me + token validity matrix (todos.md: expired, malformed, missing, valid) ---


async def test_me_with_valid_token(api_client):
    await _register(api_client, "me@test.dev")
    login = await api_client.post(
        "/auth/login", data={"username": "me@test.dev", "password": PASSWORD}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resp = await api_client.get("/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@test.dev"


async def test_expired_token_401(api_client):
    expired = _make_token("11111111-1111-1111-1111-111111111111", "access", timedelta(seconds=-60))
    resp = await api_client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


async def test_malformed_token_401(api_client):
    resp = await api_client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert resp.status_code == 401


async def test_missing_token_401(api_client):
    resp = await api_client.get("/auth/me")
    assert resp.status_code == 401


async def test_wrong_secret_token_401(api_client):
    settings = get_settings()
    now = datetime.now(UTC)
    forged = pyjwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "type": "access",
            "exp": now + timedelta(minutes=5),
        },
        "attacker-secret",
        algorithm=settings.jwt_algorithm,
    )
    resp = await api_client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert resp.status_code == 401


async def test_refresh_token_rejected_as_access_token(api_client):
    await _register(api_client, "refresh-as-access@test.dev")
    login = await api_client.post(
        "/auth/login", data={"username": "refresh-as-access@test.dev", "password": PASSWORD}
    )
    refresh_token = login.json()["refresh_token"]
    resp = await api_client.get("/auth/me", headers={"Authorization": f"Bearer {refresh_token}"})
    assert resp.status_code == 401


# --- refresh flow ---


async def test_refresh_flow_issues_new_tokens(api_client):
    await _register(api_client, "refresh@test.dev")
    login = await api_client.post(
        "/auth/login", data={"username": "refresh@test.dev", "password": PASSWORD}
    )
    resp = await api_client.post(
        "/auth/refresh", json={"refresh_token": login.json()["refresh_token"]}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"] and body["refresh_token"]
    # new access token works
    me = await api_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200


async def test_refresh_with_access_token_401(api_client):
    await _register(api_client, "access-as-refresh@test.dev")
    login = await api_client.post(
        "/auth/login", data={"username": "access-as-refresh@test.dev", "password": PASSWORD}
    )
    resp = await api_client.post(
        "/auth/refresh", json={"refresh_token": login.json()["access_token"]}
    )
    assert resp.status_code == 401


# --- google oauth ---


async def test_google_not_configured_503(api_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "google_client_id", "")
    resp = await api_client.post("/auth/google", json={"credential": "whatever"})
    assert resp.status_code == 503


async def test_google_valid_credential(api_client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")

    from app.api import auth as auth_module

    # NOTE: must be a plain sync function — the endpoint runs it via run_in_threadpool.
    def fake_verify(credential: str) -> dict:
        return {
            "sub": "google-sub-123",
            "email": "GoogleUser@Test.dev",
            "email_verified": True,
        }

    monkeypatch.setattr(auth_module, "verify_google_id_token", fake_verify)

    resp = await api_client.post("/auth/google", json={"credential": "fake-id-token"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]

    me = await api_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "googleuser@test.dev"

    # second login with same google sub → same account (upsert by auth_provider_id)
    resp2 = await api_client.post("/auth/google", json={"credential": "fake-id-token"})
    me2 = await api_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {resp2.json()['access_token']}"}
    )
    assert me2.json()["id"] == me.json()["id"]


async def test_google_links_existing_password_account(api_client, monkeypatch):
    from app.api import auth as auth_module

    def fake_verify(credential: str) -> dict:
        return {"sub": "google-sub-456", "email": "existing@test.dev", "email_verified": True}

    monkeypatch.setattr(get_settings(), "google_client_id", "test-client-id")
    monkeypatch.setattr(auth_module, "verify_google_id_token", fake_verify)

    await _register(api_client, "existing@test.dev")
    resp = await api_client.post("/auth/google", json={"credential": "fake-id-token"})
    assert resp.status_code == 200


async def test_google_unverified_email_401(api_client, monkeypatch):
    from app.api import auth as auth_module

    def fake_verify(credential: str) -> dict:
        return {"sub": "google-sub-789", "email": "unverified@test.dev", "email_verified": False}

    monkeypatch.setattr(get_settings(), "google_client_id", "test-client-id")
    monkeypatch.setattr(auth_module, "verify_google_id_token", fake_verify)
    resp = await api_client.post("/auth/google", json={"credential": "fake-id-token"})
    assert resp.status_code == 401


async def test_google_invalid_credential_401(api_client, monkeypatch):
    import jwt as pyjwt_

    from app.api import auth as auth_module

    def fake_verify(credential: str) -> dict:
        raise pyjwt_.InvalidTokenError("bad signature")

    monkeypatch.setattr(get_settings(), "google_client_id", "test-client-id")
    monkeypatch.setattr(auth_module, "verify_google_id_token", fake_verify)
    resp = await api_client.post("/auth/google", json={"credential": "forged"})
    assert resp.status_code == 401
