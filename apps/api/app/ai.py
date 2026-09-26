import json
from typing import Any

import httpx

from .config import get_settings


class AIUnavailable(Exception):
    pass


class GeminiAdapter:
    """Small provider adapter shared by chat and recommendation services."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        settings = get_settings()
        self.api_key = api_key or settings.gemini_api_key
        self.model = model or settings.ai_model

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        if not self.api_key:
            raise AIUnavailable("AI provider is not configured")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload: dict[str, Any] = {"contents": [{"parts": [{"text": prompt}]}]}
        if json_mode:
            payload["generationConfig"] = {"responseMimeType": "application/json"}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, params={"key": self.api_key}, json=payload)
        if response.status_code >= 400:
            raise AIUnavailable(f"AI provider returned {response.status_code}")
        data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise AIUnavailable("AI provider returned an empty response") from exc

    async def generate_json(self, prompt: str, fallback: dict[str, Any]) -> dict[str, Any]:
        try:
            raw = await self.generate(prompt, json_mode=True)
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else fallback
        except (AIUnavailable, json.JSONDecodeError, httpx.HTTPError):
            return fallback

