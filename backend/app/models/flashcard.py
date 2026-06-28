import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Relationship


class BaseFlashcard(ABC):
    @property
    @abstractmethod
    def front(self) -> str:
        ...

    @property
    @abstractmethod
    def back(self) -> str:
        ...


class Deck(SQLModel, table=True):
    __tablename__ = "deck"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    flashcards: list["Flashcard"] = Relationship(back_populates="deck")


class Flashcard(SQLModel, BaseFlashcard, table=True):
    __tablename__ = "flashcard"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    deck_id: str = Field(foreign_key="deck.id", index=True)
    card_type: str = Field(default="cloze_deletion", index=True)

    sentence: Optional[str] = None
    sentence_pinyin: Optional[str] = None
    answer: Optional[str] = None
    answer_pinyin: Optional[str] = None
    context: Optional[str] = None
    context_pinyin: Optional[str] = None
    image_path: Optional[str] = None
    audio_path: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    deck: Optional[Deck] = Relationship(back_populates="flashcards")
    vocabulary_state: Optional["UserVocabularyState"] = Relationship(
        back_populates="flashcard"
    )

    @property
    def front(self) -> str:
        return self.sentence or ""

    @property
    def back(self) -> str:
        return self.answer or ""


class UserVocabularyState(SQLModel, table=True):
    __tablename__ = "user_vocabulary_state"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    flashcard_id: str = Field(foreign_key="flashcard.id", unique=True, index=True)
    srs_interval: int = Field(default=0)
    ease_factor: float = Field(default=2.5)
    total_reviews: int = Field(default=0)
    total_failures: int = Field(default=0)
    consecutive_failures: int = Field(default=0)
    consecutive_correct: int = Field(default=0)
    difficulty_score: float = Field(default=0.0, index=True)

    flashcard: Optional[Flashcard] = Relationship(back_populates="vocabulary_state")
