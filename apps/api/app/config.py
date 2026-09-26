from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "BabyStar API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://babystar:babystar@db:5432/babystar"
    web_origin: str = "http://localhost:3000"
    session_cookie: str = "babystar_session"
    session_hours: int = 24
    session_secure: bool = False
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


@lru_cache
def get_settings() -> Settings:
    return Settings()

