from __future__ import annotations

from pydantic import BaseModel


class SrsHealthCard(BaseModel):
    flashcard_id: str
    answer: str
    sentence: str
    difficulty_score: float
    total_reviews: int
    total_failures: int
    srs_interval: int
    last_reviewed_at: str | None = None
    next_review_at: str | None = None


class SrsHealthResponse(BaseModel):
    timezone: str
    now: str
    scheduled_cards: int
    unscheduled_reviewed_cards: int
    new_cards: int
    due_today: int
    due_tomorrow: int
    hardest_due: list[SrsHealthCard]
    recently_reviewed: list[SrsHealthCard]
