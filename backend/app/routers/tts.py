from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.tts import synthesize_speech

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tts"])


class TTSRequest(BaseModel):
    text: str


@router.post("/tts")
async def generate_tts(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_bytes = await synthesize_speech(request.text)
        from fastapi.responses import Response

        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        logger.error("TTS generation failed: %s", e)
        raise HTTPException(status_code=500, detail="TTS generation failed")
