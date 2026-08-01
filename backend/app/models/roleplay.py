from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Text, text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RoleplaySession(SQLModel, table=True):
    __tablename__ = "roleplay_session"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    scenario_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("scenario.id"), nullable=False, index=True
        ),
    )
    started_at: datetime = Field(
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    ended_at: datetime | None = Field(default=None, sa_column=Column(DateTime))
    scenario_title: str | None = Field(default=None, sa_column=Column(Text))
    scenario_description: str | None = Field(default=None, sa_column=Column(Text))
    scenario_difficulty: str | None = Field(default=None, sa_column=Column(Text))
    scenario_target_grammar: str | None = Field(default=None, sa_column=Column(Text))


class RoleplaySessionTarget(SQLModel, table=True):
    __tablename__ = "roleplay_session_target"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("roleplay_session.id"), nullable=False, index=True
        ),
    )
    flashcard_id: str | None = Field(
        default=None,
        sa_column=Column(
            ForeignKey("flashcard.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    target_text: str = Field(sa_column=Column(Text, nullable=False))
    target_pinyin: str | None = Field(default=None, sa_column=Column(Text))
    source: str = Field(sa_column=Column(Text, nullable=False))
    sequence: int = Field(sa_column=Column(Integer, nullable=False))
    status: str = Field(default="pending", sa_column=Column(Text, nullable=False))
    attempts: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    hints_used: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    selected_srs_difficulty: float = Field(
        default=0.0, sa_column=Column(Float, nullable=False)
    )
    selected_roleplay_difficulty: float = Field(
        default=0.5, sa_column=Column(Float, nullable=False)
    )
    created_at: datetime = Field(
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    completed_at: datetime | None = Field(default=None, sa_column=Column(DateTime))


class RoleplayVocabularyState(SQLModel, table=True):
    __tablename__ = "roleplay_vocabulary_state"

    flashcard_id: str = Field(
        sa_column=Column(
            ForeignKey("flashcard.id", ondelete="CASCADE"), primary_key=True
        )
    )
    production_difficulty: float = Field(
        default=0.5, sa_column=Column(Float, nullable=False)
    )
    total_sessions: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    total_attempts: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    successful_sessions: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    failed_sessions: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    consecutive_failures: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    last_practiced_at: datetime | None = Field(default=None, sa_column=Column(DateTime))
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime, nullable=False),
    )


class ChatLog(SQLModel, table=True):
    __tablename__ = "chat_log"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("roleplay_session.id"), nullable=False, index=True
        ),
    )
    timestamp: datetime = Field(
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    sender: str = Field(sa_column=Column(Text, nullable=False))
    text_content: str = Field(sa_column=Column(Text, nullable=False))


class TurnEvaluation(SQLModel, table=True):
    __tablename__ = "turn_evaluation"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    chat_log_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("chat_log.id"), nullable=False, index=True
        ),
    )
    target_flashcard_id: str = Field(
        sa_column=Column(
            ForeignKey("flashcard.id"), nullable=False, index=True
        ),
    )
    grammar_passed: bool = Field(
        sa_column=Column(Boolean, nullable=False),
    )
