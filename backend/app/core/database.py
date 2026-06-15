from __future__ import annotations

from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings
from app.models import (  # noqa: F401 — ensure all tables are registered
    ChatLog,
    Flashcard,
    RoleplaySession,
    Scenario,
    ShadowingAttempt,
    ShadowingMedia,
    SyncLog,
    TurnEvaluation,
    UserVocabularyState,
)

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
