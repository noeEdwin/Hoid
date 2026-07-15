from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    APP_NAME: str = "Tars Backend"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite:///./tars.db"
    SRS_TIMEZONE: str = "America/Chicago"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    GROQ_API_KEY: str = ""
    GROQ_API_URL: str = "https://api.groq.com/openai/v1"

    TTS_PROVIDER: str = "edge-tts"
    EDGE_TTS_VOICE: str = "zh-CN-XiaoxiaoNeural"
    EDGE_TTS_RATE: str = "+0%"
    EDGE_TTS_VOLUME: str = "+0%"

    BASE_DIR: Path = _PROJECT_ROOT

    model_config = {"env_file": str(_PROJECT_ROOT / ".env"), "env_file_encoding": "utf-8"}


settings = Settings()
