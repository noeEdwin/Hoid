from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class FlashcardCreate(BaseModel):
    character: str
    pinyin: str
    meaning: str
    grammar_type: str


class FlashcardUpdate(BaseModel):
    character: str | None = None
    pinyin: str | None = None
    meaning: str | None = None
    grammar_type: str | None = None


class FlashcardResponse(BaseModel):
    id: uuid.UUID
    character: str
    pinyin: str
    meaning: str
    grammar_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FlashcardListResponse(BaseModel):
    flashcards: list[FlashcardResponse]
    total: int
