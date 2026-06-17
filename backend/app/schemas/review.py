from __future__ import annotations

import uuid
from enum import Enum

from pydantic import BaseModel


class ReviewRating(str, Enum):
    easy = "easy"
    good = "good"
    hard = "hard"


class ReviewSubmit(BaseModel):
    flashcard_id: uuid.UUID
    review_rating: ReviewRating
    response_time_ms: int


class ReviewResponse(BaseModel):
    status: str
    flashcard_id: uuid.UUID
    new_srs_interval: int
    new_difficulty_score: float


class ReviewQueueItem(BaseModel):
    flashcard_id: uuid.UUID
    character: str
    pinyin: str
    meaning: str
    grammar_type: str
    srs_interval: int
    ease_factor: float
    difficulty_score: float
    total_reviews: int
    total_failures: int


class ReviewQueueResponse(BaseModel):
    queue: list[ReviewQueueItem]
    total_pending: int
