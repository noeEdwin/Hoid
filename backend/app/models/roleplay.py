from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, ForeignKey, Index, Text, text
from sqlmodel import Field, SQLModel


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
    ended_at: datetime | None = Field(default=None, sa_column=Column(Text))


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
    target_flashcard_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("flashcard.id"), nullable=False, index=True
        ),
    )
    grammar_passed: bool = Field(
        sa_column=Column(Boolean, nullable=False),
    )
