from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.flashcard import Deck, Flashcard, UserVocabularyState


class TestReviewQueue:
    def test_empty_initially(self, client: TestClient) -> None:
        deck_id = uuid.uuid4()
        r = client.get(f"/api/decks/{deck_id}/review")
        assert r.status_code == 200
        assert r.json()["total_pending"] == 0

    def test_orders_by_difficulty(self, client: TestClient, db_session: Session) -> None:
        deck = Deck(name="Test Deck")
        db_session.add(deck)
        db_session.flush()

        fc1 = Flashcard(deck_id=deck.id, sentence="我___你", answer="爱", sentence_pinyin="wǒ ài nǐ", answer_pinyin="ài", card_type="cloze_deletion")
        fc2 = Flashcard(deck_id=deck.id, sentence="他是我的___", answer="朋友", sentence_pinyin="tā shì wǒ de péng yǒu", answer_pinyin="péng yǒu", card_type="cloze_deletion")
        db_session.add(fc1)
        db_session.add(fc2)
        db_session.commit()
        db_session.refresh(fc1)
        db_session.refresh(fc2)

        client.post(f"/api/flashcards/{fc1.id}/review", json={
            "flashcard_id": str(fc1.id),
            "is_correct": True,
            "response_time_ms": 1000,
        })
        client.post(f"/api/flashcards/{fc2.id}/review", json={
            "flashcard_id": str(fc2.id),
            "is_correct": False,
            "response_time_ms": 5000,
        })
        r = client.get(f"/api/decks/{deck.id}/review")
        queue = r.json()["queue"]
        assert queue == []

    def test_respects_limit(self, client: TestClient, db_session: Session) -> None:
        deck = Deck(name="Limit Deck")
        db_session.add(deck)
        db_session.flush()

        for i in range(5):
            card = Flashcard(deck_id=deck.id, sentence=f"句子{i}", answer=f"词{i}", sentence_pinyin=f"sentence {i}", answer_pinyin=f"word {i}", card_type="cloze_deletion")
            db_session.add(card)
        db_session.commit()

        r = client.get(f"/api/decks/{deck.id}/review?limit=2")
        assert r.json()["total_pending"] == 2


class TestSubmitReview:
    def test_creates_vocab_state(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        r = client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 2000,
        })
        assert r.status_code == 200
        assert r.json()["status"] == "success"

    def test_learning_step_progression(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        r1 = client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 2000,
        })
        assert r1.json()["new_srs_interval"] == 1

        r2 = client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 2000,
        })
        assert r2.json()["new_srs_interval"] == 3

        r3 = client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 2000,
        })
        assert r3.json()["new_srs_interval"] == 7

    def test_hard_resets_interval(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 2000,
        })
        r = client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": False,
            "response_time_ms": 3000,
        })
        assert r.json()["new_srs_interval"] == 1

    def test_consecutive_failures_tracked(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()
        for _ in range(3):
            client.post(f"/api/flashcards/{fc.id}/review", json={
                "flashcard_id": str(fc.id),
                "is_correct": False,
                "response_time_ms": 3000,
            })
        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is not None
        assert state.consecutive_failures == 3

    def test_good_resets_consecutive_failures(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()
        for _ in range(3):
            client.post(f"/api/flashcards/{fc.id}/review", json={
                "flashcard_id": str(fc.id),
                "is_correct": False,
                "response_time_ms": 3000,
            })
        client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 2000,
        })
        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is not None
        assert state.consecutive_failures == 0

    def test_total_reviews_increments(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()
        client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 2000,
        })
        client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": True,
            "response_time_ms": 1000,
        })
        state = db_session.exec(
            select(UserVocabularyState).where(UserVocabularyState.flashcard_id == fc.id)
        ).first()
        assert state is not None
        assert state.total_reviews == 2

    def test_mastery_tracking(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()
        for _ in range(3):
            r = client.post(f"/api/flashcards/{fc.id}/review", json={
                "flashcard_id": str(fc.id),
                "is_correct": True,
                "response_time_ms": 2000,
            })
        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is not None
        assert state.consecutive_correct == 3
        assert r.json()["mastered"] is True

    def test_failure_resets_mastery(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()
        for _ in range(3):
            client.post(f"/api/flashcards/{fc.id}/review", json={
                "flashcard_id": str(fc.id),
                "is_correct": True,
                "response_time_ms": 2000,
            })
        client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": False,
            "response_time_ms": 5000,
        })
        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is not None
        assert state.consecutive_correct == 0
