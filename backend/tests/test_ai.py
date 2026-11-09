import asyncio
import json

import httpx
import pytest

from app import ai


def use_mock_transport(monkeypatch, handler) -> None:
    async_client = httpx.AsyncClient

    class MockAsyncClient(async_client):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(ai.httpx, "AsyncClient", MockAsyncClient)


def test_ask_openrouter_sends_configured_model_and_returns_message(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == ai.OPENROUTER_URL
        assert request.headers["Authorization"] == "Bearer test-key"
        assert json.loads(request.read()) == {
            "model": ai.OPENROUTER_MODEL,
            "messages": [{"role": "user", "content": "What is 2 + 2?"}],
        }
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "  4\n"}}]},
        )

    use_mock_transport(monkeypatch, handler)

    assert asyncio.run(ai.ask_openrouter("What is 2 + 2?")) == "4"


def test_ask_openrouter_requires_environment_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(
        ai.OpenRouterConfigurationError,
        match="OPENROUTER_API_KEY is not configured",
    ):
        asyncio.run(ai.ask_openrouter("Test"))


def test_ask_openrouter_reports_upstream_status_without_response_body(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    use_mock_transport(
        monkeypatch,
        lambda _: httpx.Response(401, text="sensitive upstream response"),
    )

    with pytest.raises(ai.OpenRouterRequestError) as error:
        asyncio.run(ai.ask_openrouter("Test"))

    assert str(error.value) == "OpenRouter returned HTTP 401."
    assert "sensitive" not in str(error.value)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, text="not-json"),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, json={"choices": [{"message": {"content": " "}}]}),
    ],
)
def test_ask_openrouter_rejects_invalid_model_responses(
    monkeypatch, response: httpx.Response
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    use_mock_transport(monkeypatch, lambda _: response)

    with pytest.raises(ai.OpenRouterRequestError):
        asyncio.run(ai.ask_openrouter("Test"))


def test_ask_openrouter_reports_connection_errors(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("internal network detail", request=request)

    use_mock_transport(monkeypatch, handler)

    with pytest.raises(
        ai.OpenRouterRequestError, match="Could not reach OpenRouter"
    ):
        asyncio.run(ai.ask_openrouter("Test"))
