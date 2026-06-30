from __future__ import annotations

import asyncio
import logging
import edge_tts

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0


async def synthesize_speech(text: str) -> bytes:
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            communicate = edge_tts.Communicate(
                text,
                voice=settings.EDGE_TTS_VOICE,
                rate=settings.EDGE_TTS_RATE,
                volume=settings.EDGE_TTS_VOLUME,
            )
            audio = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
            return audio
        except Exception as e:
            last_error = e
            delay = RETRY_BASE_DELAY * (2 ** attempt)
            logger.warning(
                "TTS failed on attempt %d/%d, retrying in %.1fs: %s",
                attempt + 1,
                MAX_RETRIES,
                delay,
                e,
            )
            await asyncio.sleep(delay)

    raise last_error  # type: ignore[misc]

