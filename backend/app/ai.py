import os

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "recursive/flint-v1.0:free"
CONNECTIVITY_PROMPT = "What is 2 + 2? Reply with only the number."
REQUEST_TIMEOUT = 30.0


class OpenRouterConfigurationError(Exception):
    pass


class OpenRouterRequestError(Exception):
    pass


async def ask_openrouter(prompt: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise OpenRouterConfigurationError(
            "OPENROUTER_API_KEY is not configured."
        )

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                OPENROUTER_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
    except httpx.HTTPError as error:
        raise OpenRouterRequestError("Could not reach OpenRouter.") from error

    if response.is_error:
        raise OpenRouterRequestError(
            f"OpenRouter returned HTTP {response.status_code}."
        )

    try:
        data = response.json()
    except ValueError as error:
        raise OpenRouterRequestError(
            "OpenRouter returned an invalid response."
        ) from error

    choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise OpenRouterRequestError(
            "OpenRouter response did not contain a message."
        )

    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise OpenRouterRequestError(
            "OpenRouter response did not contain a message."
        )
    return content.strip()
