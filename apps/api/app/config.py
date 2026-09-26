from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "BabyStar API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://babystar:babystar@db:5432/babystar"
    cors_allowed_origins: str = "https://babystar.qminh.com,https://babystar.mom"
    session_cookie: str = "babystar_session"
    session_hours: int = 24
    session_secure: bool = False
    session_samesite: Literal["lax", "strict", "none"] = "lax"
    google_client_id: str | None = None
    geoapify_api_key: str | None = None
    gemini_api_key: str | None = None
    gemini_api_key_weekly_advice: str | None = None
    gemini_api_key_nutrition_suggestions: str | None = None
    gemini_api_key_exercise_suggestions: str | None = None
    gemini_api_key_quiz: str | None = None
    chatbot_model: str = "gemini-2.5-flash"
    ai_model: str = "gemini-2.5-flash"
    max_chat_prompt_chars: int = 4000

    model_config = SettingsConfigDict(env_file=(".env", "apps/api/.env"), extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
