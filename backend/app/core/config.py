from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Tars Backend"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite:///./tars.db"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    GROQ_API_KEY: str = ""
    GROQ_API_URL: str = "https://api.groq.com/openai/v1"

    TTS_PROVIDER: str = "edge-tts"

    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


settings = Settings()
