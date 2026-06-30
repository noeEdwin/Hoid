from __future__ import annotations

import asyncio
import io
import logging

from openai import AsyncOpenAI
from openai import RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_API_URL,
        )
    return _client


async def transcribe_audio(audio_bytes: bytes) -> str:
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.wav"

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            response = await _get_client().audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file,
                language="zh",
            )
            return response.text
        except RateLimitError as e:
            last_error = e
            retry_after = RETRY_BASE_DELAY * (2 ** attempt)
            if e.response is not None and e.response.headers.get("retry-after"):
                try:
                    retry_after = float(e.response.headers["retry-after"])
                except ValueError:
                    pass
            logger.warning(
                "Rate limited on attempt %d/%d, retrying in %.1fs",
                attempt + 1,
                MAX_RETRIES,
                retry_after,
            )
            audio_file.seek(0)
            await asyncio.sleep(retry_after)

    raise last_error  # type: ignore[misc]
