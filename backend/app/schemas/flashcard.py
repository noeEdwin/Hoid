from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DeckCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DeckListResponse(BaseModel):
    decks: list["DeckResponse"]


class DeckResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class FlashcardCreate(BaseModel):
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


class FlashcardUpdate(BaseModel):
    sentence: Optional[str] = None
    sentence_pinyin: Optional[str] = None
    answer: Optional[str] = None
    answer_pinyin: Optional[str] = None
    context: Optional[str] = None
    context_pinyin: Optional[str] = None
    image_path: Optional[str] = None
    audio_path: Optional[str] = None


class FlashcardResponse(BaseModel):
    id: str
    deck_id: str
    card_type: str
    sentence: Optional[str]
    sentence_pinyin: Optional[str]
    answer: Optional[str]
    answer_pinyin: Optional[str]
    context: Optional[str]
    context_pinyin: Optional[str]
    image_path: Optional[str]
    audio_path: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FlashcardListResponse(BaseModel):
    flashcards: list[FlashcardResponse]
    total: int


class UserVocabularyStateResponse(BaseModel):
    id: str
    flashcard_id: str
    srs_interval: int
    ease_factor: float
    total_reviews: int
    total_failures: int
    consecutive_failures: int
    consecutive_correct: int
    difficulty_score: float
    updated_at: datetime

    model_config = {"from_attributes": True}
