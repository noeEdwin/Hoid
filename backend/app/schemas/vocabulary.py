from __future__ import annotations

import uuid

from pydantic import BaseModel


class DifficultToken(BaseModel):
    flashcard_id: uuid.UUID
    character: str
    pinyin: str
    meaning: str
    grammar_type: str
    difficulty_score: float
    total_reviews: int
    total_failures: int


class DifficultTokensResponse(BaseModel):
    difficult_tokens: list[DifficultToken]


class VocabProfileItem(BaseModel):
    flashcard_id: uuid.UUID
    character: str
    pinyin: str
    meaning: str
    difficulty_score: float


class VocabProfileResponse(BaseModel):
    known_words: list[VocabProfileItem]
    total_known: int
    total_cards: int
