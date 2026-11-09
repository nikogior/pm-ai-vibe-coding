from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
import re
import sqlite3
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.ai import OpenRouterConfigurationError, OpenRouterRequestError
from app.database import hash_session_token
from app.main import FRONTEND_DIR, SESSION_COOKIE, create_app


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    application = create_app(
        database_path=tmp_path / "kanban.sqlite3",
        frontend_dir=FRONTEND_DIR,
    )
    with TestClient(application) as test_client:
        yield test_client


def sign_in(client: TestClient):
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200
    return response


def test_root_serves_sign_in_export_and_frontend_assets(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Checking sign-in" in response.text
    assert "Align roadmap themes" not in response.text

    stylesheet = re.search(r'href="([^"]+\.css)"', response.text)
    assert stylesheet is not None
    asset_response = client.get(stylesheet.group(1))
    assert asset_response.status_code == 200
    assert "text/css" in asset_response.headers["content-type"]


def test_healthcheck_and_hello(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/hello").json() == {
        "message": "Hello from FastAPI",
        "status": "ok",
    }


def test_ai_connectivity_requires_authentication_and_returns_model_response(
    client: TestClient, monkeypatch
) -> None:
    ask_openrouter = AsyncMock(return_value="4")
    monkeypatch.setattr("app.main.ask_openrouter", ask_openrouter)

    assert client.post("/api/ai/connectivity").status_code == 401
    ask_openrouter.assert_not_awaited()

    sign_in(client)
    response = client.post("/api/ai/connectivity")
    assert response.status_code == 200
    assert response.json() == {"response": "4"}
    ask_openrouter.assert_awaited_once()


@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (
            OpenRouterConfigurationError("OPENROUTER_API_KEY is not configured."),
            503,
            "OPENROUTER_API_KEY is not configured.",
        ),
        (
            OpenRouterRequestError("Could not reach OpenRouter."),
            502,
            "Could not reach OpenRouter.",
        ),
    ],
)
def test_ai_connectivity_returns_explicit_error(
    client: TestClient, monkeypatch, error, status_code: int, detail: str
) -> None:
    monkeypatch.setattr("app.main.ask_openrouter", AsyncMock(side_effect=error))
    sign_in(client)

    response = client.post("/api/ai/connectivity")

    assert response.status_code == status_code
    assert response.json() == {"detail": detail}


def test_database_initializes_schema_and_seed_board(
    client: TestClient, tmp_path
) -> None:
    database_path = tmp_path / "kanban.sqlite3"
    assert database_path.exists()
    with sqlite3.connect(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        assert {
            "users",
            "boards",
            "columns",
            "cards",
            "auth_sessions",
        } <= tables
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM columns").fetchone()[0] == 5
        assert connection.execute("SELECT COUNT(*) FROM cards").fetchone()[0] == 8


def test_login_rejects_bad_credentials_and_sets_persistent_cookie(
    client: TestClient, tmp_path
) -> None:
    bad_response = client.post(
        "/api/auth/login", json={"username": "user", "password": "incorrect"}
    )
    assert bad_response.status_code == 401
    assert client.get("/api/auth/session").json() == {"authenticated": False}

    login_response = sign_in(client)
    cookie = client.cookies.get(SESSION_COOKIE)
    assert cookie is not None
    cookie_header = login_response.headers["set-cookie"].lower()
    assert "httponly" in cookie_header
    assert f"max-age={30 * 24 * 60 * 60}" in cookie_header
    assert "samesite=lax" in cookie_header
    cookie_header = client.cookies.jar
    session_cookie = next(cookie for cookie in cookie_header if cookie.name == SESSION_COOKIE)
    assert session_cookie.has_nonstandard_attr("HttpOnly")
    assert session_cookie.get_nonstandard_attr("SameSite") == "lax"
    assert session_cookie.expires is not None
    assert client.get("/api/auth/session").json() == {
        "authenticated": True,
        "username": "user",
    }

    with sqlite3.connect(tmp_path / "kanban.sqlite3") as connection:
        stored_token_hash = connection.execute(
            "SELECT token_hash FROM auth_sessions"
        ).fetchone()[0]
    assert stored_token_hash != cookie


def test_session_survives_app_restart_and_logout_revokes_it(tmp_path) -> None:
    database_path = tmp_path / "kanban.sqlite3"
    first_app = create_app(database_path=database_path, frontend_dir=FRONTEND_DIR)
    with TestClient(first_app) as first_client:
        sign_in(first_client)
        cookies = first_client.cookies

    restarted_app = create_app(database_path=database_path, frontend_dir=FRONTEND_DIR)
    with TestClient(restarted_app, cookies=cookies) as restarted_client:
        assert restarted_client.get("/api/auth/session").json() == {
            "authenticated": True,
            "username": "user",
        }
        logout_response = restarted_client.post("/api/auth/logout")
        assert logout_response.status_code == 204
        assert restarted_client.get("/api/auth/session").json() == {
            "authenticated": False
        }
        assert restarted_client.get("/api/board").status_code == 401


def test_expired_session_is_rejected_and_removed(
    client: TestClient, tmp_path
) -> None:
    sign_in(client)
    token = client.cookies.get(SESSION_COOKIE)
    assert token is not None
    expired_at = (datetime.now(UTC) - timedelta(days=1)).isoformat(timespec="seconds")
    with sqlite3.connect(tmp_path / "kanban.sqlite3") as connection:
        connection.execute(
            "UPDATE auth_sessions SET expires_at = ? WHERE token_hash = ?",
            (expired_at, hash_session_token(token)),
        )

    assert client.get("/api/auth/session").json() == {"authenticated": False}
    assert client.get("/api/board").status_code == 401
    with sqlite3.connect(tmp_path / "kanban.sqlite3") as connection:
        assert connection.execute("SELECT COUNT(*) FROM auth_sessions").fetchone()[0] == 0


def test_board_requires_authentication_and_returns_seed_data(
    client: TestClient,
) -> None:
    assert client.get("/api/board").status_code == 401
    sign_in(client)
    response = client.get("/api/board")
    assert response.status_code == 200
    board = response.json()
    assert [column["id"] for column in board["columns"]] == [
        "col-backlog",
        "col-discovery",
        "col-progress",
        "col-review",
        "col-done",
    ]
    assert board["columns"][0]["cardIds"] == ["card-1", "card-2"]
    assert board["cards"]["card-1"]["title"] == "Align roadmap themes"


def test_board_update_persists_card_and_column_changes(client: TestClient) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    board["columns"][0]["title"] = "Ideas"
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][1]["cardIds"].append("card-1")
    board["cards"]["card-1"]["title"] = "Updated roadmap themes"
    board["cards"]["card-new"] = {
        "id": "card-new",
        "title": "New task",
        "details": "Persisted by the API",
    }
    board["columns"][4]["cardIds"].append("card-new")
    del board["cards"]["card-8"]
    board["columns"][4]["cardIds"].remove("card-8")

    update_response = client.put("/api/board", json=board)
    assert update_response.status_code == 200
    saved = client.get("/api/board").json()
    assert saved["columns"][0]["title"] == "Ideas"
    assert saved["columns"][1]["cardIds"][-1] == "card-1"
    assert saved["cards"]["card-1"]["title"] == "Updated roadmap themes"
    assert "card-new" in saved["cards"]
    assert "card-8" not in saved["cards"]


@pytest.mark.parametrize(
    "mutate",
    [
        lambda board: board["columns"][0]["cardIds"].append("missing-card"),
        lambda board: board["columns"].pop(),
        lambda board: board["columns"][1]["cardIds"].append("card-1"),
    ],
)
def test_board_update_rejects_invalid_structure(
    client: TestClient, mutate
) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    mutate(board)
    response = client.put("/api/board", json=board)
    assert response.status_code == 422
