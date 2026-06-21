from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class ReviewRating(str, Enum):
    good = "good"
    hard = "hard"


class ReviewSubmit(BaseModel):
    flashcard_id: str
    is_correct: bool
    response_time_ms: int


class ReviewResponse(BaseModel):
    status: str
    flashcard_id: str
    new_srs_interval: int
    new_difficulty_score: float


class ReviewQueueItem(BaseModel):
    flashcard_id: str
    sentence: str
    sentence_pinyin: str
    answer: str
    answer_pinyin: str
    card_type: str
    srs_interval: int
    ease_factor: float
    difficulty_score: float
    total_reviews: int
    total_failures: int
    consecutive_failures: int


class ReviewQueueResponse(BaseModel):
    queue: list[ReviewQueueItem]
    total_pending: int
