from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, Index, Text, text
from sqlmodel import Field, SQLModel


class Scenario(SQLModel, table=True):
    __tablename__ = "scenario"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    title: str = Field(sa_column=Column(Text, nullable=False, index=True))
    description: str = Field(sa_column=Column(Text, nullable=False))
    difficulty: str = Field(sa_column=Column(Text, nullable=False, index=True))
    target_grammar: str = Field(sa_column=Column(Text, nullable=False))
    example_prompt: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(
        sa_column_kwargs={"server_default": text("now()")},
    )
