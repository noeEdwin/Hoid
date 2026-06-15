from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, Float, ForeignKey, Index, Text, text
from sqlmodel import Field, SQLModel


class ShadowingMedia(SQLModel, table=True):
    __tablename__ = "shadowing_media"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    flashcard_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("flashcard.id"), nullable=False, index=True
        ),
    )
    audio_file_path: str = Field(sa_column=Column(Text, nullable=False))
    native_pitch_contour: str = Field(sa_column=Column(Text, nullable=False))


class ShadowingAttempt(SQLModel, table=True):
    __tablename__ = "shadowing_attempt"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    shadowing_media_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("shadowing_media.id"), nullable=False, index=True
        ),
    )
    pitch_match_score: float = Field(
        sa_column=Column(Float, nullable=False),
    )
    user_pitch_curve: str | None = Field(default=None, sa_column=Column(Text))
    completed_at: datetime = Field(
        sa_column_kwargs={"server_default": text("now()")},
    )
