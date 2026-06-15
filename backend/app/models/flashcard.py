from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, Float, ForeignKey, Index, Integer, Text, text
from sqlmodel import Field, SQLModel


class Flashcard(SQLModel, table=True):
    __tablename__ = "flashcard"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    character: str = Field(sa_column=Column(Text, nullable=False, index=True))
    pinyin: str = Field(sa_column=Column(Text, nullable=False))
    meaning: str = Field(sa_column=Column(Text, nullable=False))
    grammar_type: str = Field(sa_column=Column(Text, nullable=False, index=True))
    created_at: datetime = Field(
        sa_column_kwargs={"server_default": text("now()")},
    )


class UserVocabularyState(SQLModel, table=True):
    __tablename__ = "user_vocabulary_state"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    flashcard_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("flashcard.id"),
            nullable=False,
            unique=True,
            index=True,
        ),
    )
    srs_interval: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default=text("0")),
    )
    ease_factor: float = Field(
        default=2.5,
        sa_column=Column(Float, nullable=False, server_default=text("2.5")),
    )
    total_reviews: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default=text("0")),
    )
    total_failures: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default=text("0")),
    )
    difficulty_score: float = Field(
        default=0.0,
        sa_column=Column(
            Float, nullable=False, server_default=text("0.0"), index=True
        ),
    )
