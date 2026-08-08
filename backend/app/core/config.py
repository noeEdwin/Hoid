from __future__ import annotations

import ipaddress
import os
import sys
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    APP_NAME: str = "Tars Backend"
    DEBUG: bool = False
    ENVIRONMENT: Literal["development", "production"] = "development"
    HOST: str = "127.0.0.1"
    ALLOW_LAN: bool = False
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
        self.validate_host(self.HOST)

    def validate_host(self, host: str) -> None:
        normalized_host = host.strip().lower()
        lan_mode = (
            os.environ.get("TARS_STARTUP_MODE") == "lan" and "--lan" in sys.argv
        )
        if self.ALLOW_LAN and not lan_mode:
            raise ValueError("ALLOW_LAN=true requires `python run.py --lan`")
        if lan_mode and self.ENVIRONMENT != "development":
            raise ValueError("LAN mode is only available in development")
        if normalized_host == "localhost":
            return
        try:
            address = ipaddress.ip_address(normalized_host)
        except ValueError as exc:
            raise ValueError(
                "HOST must be localhost or a loopback IP; remote binds are disabled"
            ) from exc
        if address.is_loopback:
            return
        if self.ENVIRONMENT != "development" or not lan_mode:
            raise ValueError(
                "remote binds require `python run.py --lan` in development"
            )


settings = Settings()
