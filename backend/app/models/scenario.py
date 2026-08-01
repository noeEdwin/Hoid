from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Text, text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Scenario(SQLModel, table=True):
    __tablename__ = "scenario"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(sa_column=Column(Text, nullable=False, index=True))
    description: str = Field(sa_column=Column(Text, nullable=False))
    difficulty: str = Field(sa_column=Column(Text, nullable=False, index=True))
    target_grammar: str = Field(sa_column=Column(Text, nullable=False))
    example_prompt: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")},
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime, nullable=False, onupdate=_utcnow),
    )
    archived_at: datetime | None = Field(default=None, sa_column=Column(DateTime))
    seed_key: str | None = Field(default=None, sa_column=Column(Text, index=True))
