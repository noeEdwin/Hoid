from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.main import app
from app.core.database import get_session
from app.models.flashcard import Deck, Flashcard, UserVocabularyState


@pytest.fixture(name="db_session")
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def _override_session() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(name="create_flashcard")
def create_flashcard(db_session: Session) -> Generator:
    created = []

    def _create(
        sentence: str = "我___你",
        sentence_pinyin: str = "wǒ ài nǐ",
        answer: str = "爱",
        answer_pinyin: str = "ài",
        card_type: str = "cloze_deletion",
    ) -> Flashcard:
        deck = Deck(name="Test Deck")
        db_session.add(deck)
        db_session.flush()

        flashcard = Flashcard(
            deck_id=deck.id,
            sentence=sentence,
            sentence_pinyin=sentence_pinyin,
            answer=answer,
            answer_pinyin=answer_pinyin,
            card_type=card_type,
        )
        db_session.add(flashcard)
        db_session.commit()
        db_session.refresh(flashcard)
        created.append(flashcard)
        return flashcard

    yield _create

    for fc in created:
        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        if state:
            db_session.delete(state)
        db_session.delete(fc)
    db_session.commit()
