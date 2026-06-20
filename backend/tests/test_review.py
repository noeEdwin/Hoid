from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.flashcard import Flashcard, UserVocabularyState


class TestReviewQueue:
    def test_empty_initially(self, client: TestClient) -> None:
        r = client.get("/api/flashcards/review")
        assert r.status_code == 200
        assert r.json()["total_pending"] == 0

    def test_orders_by_difficulty(self, client: TestClient, create_flashcard) -> None:
        fc1 = create_flashcard(sentence="我___你", answer="爱")
        fc2 = create_flashcard(sentence="他是我的___", answer="朋友")
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc1.id),
            "review_rating": "easy",
            "response_time_ms": 1000,
        })
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc2.id),
            "review_rating": "hard",
            "response_time_ms": 5000,
        })
        r = client.get("/api/flashcards/review")
        queue = r.json()["queue"]
        assert len(queue) == 2
        assert queue[0]["answer"] == "朋友"
        assert queue[1]["answer"] == "爱"

    def test_respects_limit(self, client: TestClient, create_flashcard) -> None:
        for i in range(5):
            fc = create_flashcard(sentence=f"句子{i}", answer=f"词{i}")
            client.post("/api/flashcards/review/submit", json={
                "flashcard_id": str(fc.id),
                "review_rating": "hard",
                "response_time_ms": 3000,
            })
        r = client.get("/api/flashcards/review?limit=2")
        assert r.json()["total_pending"] == 2


class TestSubmitReview:
    def test_creates_vocab_state(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        r = client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "good",
            "response_time_ms": 2000,
        })
        assert r.status_code == 200
        assert r.json()["status"] == "success"

    def test_learning_step_progression(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        r1 = client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "good",
            "response_time_ms": 2000,
        })
        assert r1.json()["new_srs_interval"] == 1

        r2 = client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "good",
            "response_time_ms": 2000,
        })
        assert r2.json()["new_srs_interval"] == 3

        r3 = client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "good",
            "response_time_ms": 2000,
        })
        assert r3.json()["new_srs_interval"] == 7

    def test_hard_resets_interval(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "good",
            "response_time_ms": 2000,
        })
        r = client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "hard",
            "response_time_ms": 3000,
        })
        assert r.json()["new_srs_interval"] == 1

    def test_consecutive_failures_tracked(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()
        for _ in range(3):
            client.post("/api/flashcards/review/submit", json={
                "flashcard_id": str(fc.id),
                "review_rating": "hard",
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
            client.post("/api/flashcards/review/submit", json={
                "flashcard_id": str(fc.id),
                "review_rating": "hard",
                "response_time_ms": 3000,
            })
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "good",
            "response_time_ms": 2000,
        })
        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is not None
        assert state.consecutive_failures == 0

    def test_total_reviews_increments(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "good",
            "response_time_ms": 2000,
        })
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "easy",
            "response_time_ms": 1000,
        })
        r = client.get("/api/flashcards/review")
        queue = r.json()["queue"]
        assert len(queue) == 1
        assert queue[0]["total_reviews"] == 2
