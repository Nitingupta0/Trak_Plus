from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "TrakPlus API"


def test_health_readiness_shape() -> None:
    """Readiness payload always exposes both components (values depend on env)."""
    response = client.get("/health/ready")
    assert response.status_code in (200, 503)
    body = response.json()
    assert set(body["components"].keys()) == {"database", "redis"}
    for component in body["components"].values():
        assert "ok" in component
