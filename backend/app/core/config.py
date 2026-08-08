from __future__ import annotations

import ipaddress
from pathlib import Path

from pydantic_settings import BaseSettings

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    APP_NAME: str = "Tars Backend"
    DEBUG: bool = False
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",
        "http://localhost:19006",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
    ]

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

    def model_post_init(self, __context: object) -> None:
        host = self.HOST.strip().lower()
        if host == "localhost":
            return
        try:
            address = ipaddress.ip_address(host)
        except ValueError as exc:
            raise ValueError(
                "HOST must be localhost or a loopback IP; remote binds are disabled"
            ) from exc
        if not address.is_loopback:
            raise ValueError(
                "HOST must be localhost or a loopback IP; remote binds are disabled"
            )


settings = Settings()
