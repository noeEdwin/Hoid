from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, Integer, Text, text
from sqlmodel import Field, SQLModel


class SyncLog(SQLModel, table=True):
    __tablename__ = "sync_log"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    direction: str = Field(sa_column=Column(Text, nullable=False))
    synced_at: datetime = Field(
        sa_column_kwargs={"server_default": text("now()")},
    )
    flashcards_upserted: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default=text("0")),
    )
    states_upserted: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default=text("0")),
    )
    last_sync_at: datetime | None = Field(default=None, sa_column=Column(Text))
