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
    RoleplaySessionTarget,
    RoleplayVocabularyState,
    ProcessedReview,
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
            vocabulary_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(user_vocabulary_state)"))
            }
            if "last_reviewed_at" not in vocabulary_columns:
                connection.execute(text("ALTER TABLE user_vocabulary_state ADD COLUMN last_reviewed_at DATETIME"))
            if "next_review_at" not in vocabulary_columns:
                connection.execute(text("ALTER TABLE user_vocabulary_state ADD COLUMN next_review_at DATETIME"))
            connection.execute(text(
                "UPDATE user_vocabulary_state "
                "SET srs_interval = 365, "
                "next_review_at = datetime(updated_at, '+365 days') "
                "WHERE srs_interval > 365"
            ))
            connection.execute(text(
                "UPDATE user_vocabulary_state "
                "SET srs_interval = 0, next_review_at = NULL "
                "WHERE srs_interval < 0"
            ))
            connection.execute(text(
                "UPDATE user_vocabulary_state "
                "SET last_reviewed_at = updated_at, "
                "next_review_at = datetime(updated_at, '+' || srs_interval || ' days') "
                "WHERE total_reviews > 0 AND next_review_at IS NULL"
            ))

            scenario_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(scenario)"))
            }
            if "updated_at" not in scenario_columns:
                connection.execute(text("ALTER TABLE scenario ADD COLUMN updated_at DATETIME"))
            if "archived_at" not in scenario_columns:
                connection.execute(text("ALTER TABLE scenario ADD COLUMN archived_at DATETIME"))
            if "seed_key" not in scenario_columns:
                connection.execute(text("ALTER TABLE scenario ADD COLUMN seed_key TEXT"))
            connection.execute(text(
                "UPDATE scenario SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) "
                "WHERE updated_at IS NULL"
            ))
            seed_titles = {
                "cafe": "在咖啡店",
                "restaurant": "在餐馆点菜",
                "directions": "问路",
                "hotel": "酒店入住",
                "doctor": "看医生",
            }
            for seed_key, title_value in seed_titles.items():
                connection.execute(
                    text(
                        "UPDATE scenario SET seed_key = :seed_key "
                        "WHERE title = :title AND seed_key IS NULL"
                    ),
                    {"seed_key": seed_key, "title": title_value},
                )

            roleplay_columns = {
                row[1]
                for row in connection.execute(text("PRAGMA table_info(roleplay_session)"))
            }
            snapshot_columns = {
                "scenario_title": "TEXT",
                "scenario_description": "TEXT",
                "scenario_difficulty": "TEXT",
                "scenario_target_grammar": "TEXT",
            }
            for column, sql_type in snapshot_columns.items():
                if column not in roleplay_columns:
                    connection.execute(text(
                        f"ALTER TABLE roleplay_session ADD COLUMN {column} {sql_type}"
                    ))
            connection.execute(text(
                "UPDATE roleplay_session SET "
                "scenario_title = COALESCE(scenario_title, "
                "(SELECT title FROM scenario WHERE scenario.id = roleplay_session.scenario_id)), "
                "scenario_description = COALESCE(scenario_description, "
                "(SELECT description FROM scenario WHERE scenario.id = roleplay_session.scenario_id)), "
                "scenario_difficulty = COALESCE(scenario_difficulty, "
                "(SELECT difficulty FROM scenario WHERE scenario.id = roleplay_session.scenario_id)), "
                "scenario_target_grammar = COALESCE(scenario_target_grammar, "
                "(SELECT target_grammar FROM scenario WHERE scenario.id = roleplay_session.scenario_id))"
            ))


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
