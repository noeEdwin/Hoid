from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SyncDeckItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SyncFlashcardItem(BaseModel):
    id: str
    deck_id: str
    card_type: str = "cloze_deletion"
    sentence: Optional[str] = None
    sentence_pinyin: Optional[str] = None
    answer: Optional[str] = None
    answer_pinyin: Optional[str] = None
    context: Optional[str] = None
    context_pinyin: Optional[str] = None
    image_path: Optional[str] = None
    audio_path: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SyncVocabStateItem(BaseModel):
    flashcard_id: str
    srs_interval: int = 0
    ease_factor: float = 2.5
    total_reviews: int = 0
    total_failures: int = 0
    consecutive_failures: int = 0
    consecutive_correct: int = 0
    difficulty_score: float = 0.0
    last_reviewed_at: Optional[str] = None
    next_review_at: Optional[str] = None
    updated_at: Optional[str] = None


class SyncPendingReviewItem(BaseModel):
    id: str
    flashcard_id: str
    is_correct: bool
    response_time_ms: int
    failure_count: int = 0
    created_at: Optional[str] = None


class SyncPushRequest(BaseModel):
    last_sync_at: Optional[str] = None
    decks: list[SyncDeckItem] = []
    flashcards: list[SyncFlashcardItem] = []
    vocabulary_states: list[SyncVocabStateItem] = []
    pending_reviews: list[SyncPendingReviewItem] = []


class SyncPushResponse(BaseModel):
    decks_upserted: int = 0
    flashcards_upserted: int = 0
    states_upserted: int = 0
    reviews_processed: int = 0
    processed_pending_review_ids: list[str] = []


class SyncPullResponse(BaseModel):
    decks: list[SyncDeckItem] = []
    flashcards: list[SyncFlashcardItem] = []
    vocabulary_states: list[SyncVocabStateItem] = []
    synced_at: str
