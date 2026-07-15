from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import event, text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings
from app.models import ( 
    ChatLog,
    Deck,
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


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    if engine.url.get_backend_name() == "sqlite":
        with engine.begin() as connection:
            columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(user_vocabulary_state)"))
            }
            if "last_reviewed_at" not in columns:
                connection.execute(text("ALTER TABLE user_vocabulary_state ADD COLUMN last_reviewed_at DATETIME"))
            if "next_review_at" not in columns:
                connection.execute(text("ALTER TABLE user_vocabulary_state ADD COLUMN next_review_at DATETIME"))
            connection.execute(text(
                "UPDATE user_vocabulary_state "
                "SET last_reviewed_at = updated_at, "
                "next_review_at = datetime(updated_at, '+' || srs_interval || ' days') "
                "WHERE total_reviews > 0 AND next_review_at IS NULL"
            ))


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
