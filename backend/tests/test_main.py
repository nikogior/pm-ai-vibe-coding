import re

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_serves_sign_in_export() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Sign in" in response.text
    assert "username" in response.text
    assert "Align roadmap themes" not in response.text


def test_root_serves_frontend_assets() -> None:
    response = client.get("/")
    stylesheet = re.search(r'href="([^"]+\.css)"', response.text)
    assert stylesheet is not None
    asset_path = stylesheet.group(1)
    asset_response = client.get(asset_path)

    assert asset_response.status_code == 200
    assert "text/css" in asset_response.headers["content-type"]


def test_healthcheck() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_hello() -> None:
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello from FastAPI", "status": "ok"}
