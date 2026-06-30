from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.flashcard import Deck, Flashcard, UserVocabularyState


class TestSyncPush:
    def test_push_upserts_decks(self, client: TestClient) -> None:
        deck_id = str(uuid.uuid4())
        result = client.post("/api/sync/push", json={
            "decks": [{"id": deck_id, "name": "Synced Deck", "description": "Test"}],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [],
        }).json()
        assert result["decks_upserted"] == 1

    def test_push_upserts_flashcards(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Test Deck")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        fc_id = str(uuid.uuid4())
        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [{
                "id": fc_id,
                "deck_id": deck.id,
                "card_type": "cloze_deletion",
                "sentence": "我___你",
                "answer": "爱",
            }],
            "vocabulary_states": [],
            "pending_reviews": [],
        }).json()
        assert result["flashcards_upserted"] == 1

        fc = db_session.get(Flashcard, fc_id)
        assert fc is not None
        assert fc.sentence == "我___你"

    def test_push_upserts_vocab_states(
        self, client: TestClient, create_flashcard
    ) -> None:
        fc = create_flashcard()
        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [],
            "vocabulary_states": [{
                "flashcard_id": fc.id,
                "srs_interval": 1,
                "ease_factor": 2.5,
                "total_reviews": 1,
                "total_failures": 0,
                "consecutive_failures": 0,
                "consecutive_correct": 1,
                "difficulty_score": 0.1,
            }],
            "pending_reviews": [],
        }).json()
        assert result["states_upserted"] == 1

    def test_push_processes_pending_reviews(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()

        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [{
                "flashcard_id": fc.id,
                "is_correct": True,
                "response_time_ms": 2000,
            }],
        }).json()
        assert result["reviews_processed"] == 1

        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is not None
        assert state.total_reviews == 1
        assert state.consecutive_correct == 1
        assert state.difficulty_score >= 0.0

    def test_push_multiple_reviews_same_card(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()

        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [
                {"flashcard_id": fc.id, "is_correct": True, "response_time_ms": 2000},
                {"flashcard_id": fc.id, "is_correct": False, "response_time_ms": 5000},
                {"flashcard_id": fc.id, "is_correct": True, "response_time_ms": 1500},
            ],
        }).json()
        assert result["reviews_processed"] == 3

        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is not None
        assert state.total_reviews == 3
        assert state.total_failures == 1
        assert state.consecutive_failures == 0

    def test_push_nonexistent_flashcard_review(self, client: TestClient) -> None:
        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [{
                "flashcard_id": str(uuid.uuid4()),
                "is_correct": True,
                "response_time_ms": 2000,
            }],
        }).json()
        assert result["reviews_processed"] == 0

    def test_push_empty_payload(self, client: TestClient) -> None:
        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [],
        }).json()
        assert result["decks_upserted"] == 0
        assert result["reviews_processed"] == 0

    def test_push_response_shape(self, client: TestClient) -> None:
        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [],
        }).json()
        assert "decks_upserted" in result
        assert "flashcards_upserted" in result
        assert "states_upserted" in result
        assert "reviews_processed" in result


class TestSyncPull:
    def test_pull_returns_all_when_no_since(self, client: TestClient) -> None:
        result = client.get("/api/sync/pull").json()
        assert "decks" in result
        assert "flashcards" in result
        assert "vocabulary_states" in result
        assert "synced_at" in result

    def test_pull_includes_created_data(self, client: TestClient) -> None:
        deck_id = str(uuid.uuid4())
        client.post("/api/sync/push", json={
            "decks": [{"id": deck_id, "name": "Pull Test Deck", "description": None}],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [],
        })

        pull = client.get("/api/sync/pull").json()
        deck_ids = [d["id"] for d in pull["decks"]]
        assert deck_id in deck_ids

    def test_pull_filters_by_since(self, client: TestClient) -> None:
        deck_id = str(uuid.uuid4())
        client.post("/api/sync/push", json={
            "decks": [{"id": deck_id, "name": "Recent Deck", "description": None}],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [],
        })

        future = "2099-01-01T00:00:00%2B00:00"
        pull = client.get(f"/api/sync/pull?since={future}").json()
        deck_ids = [d["id"] for d in pull["decks"]]
        assert deck_id not in deck_ids

    def test_pull_future_since_returns_empty(self, client: TestClient) -> None:
        future = "2099-01-01T00:00:00%2B00:00"
        pull = client.get(f"/api/sync/pull?since={future}").json()
        assert len(pull["decks"]) == 0
        assert len(pull["flashcards"]) == 0

    def test_pull_response_shape(self, client: TestClient) -> None:
        result = client.get("/api/sync/pull").json()
        assert isinstance(result["decks"], list)
        assert isinstance(result["flashcards"], list)
        assert isinstance(result["vocabulary_states"], list)
        assert isinstance(result["synced_at"], str)

    def test_pull_deck_includes_updated_at(self, client: TestClient) -> None:
        deck_id = str(uuid.uuid4())
        client.post("/api/sync/push", json={
            "decks": [{"id": deck_id, "name": "Timestamp Deck", "description": None}],
            "flashcards": [],
            "vocabulary_states": [],
            "pending_reviews": [],
        })

        pull = client.get("/api/sync/pull").json()
        deck = next(d for d in pull["decks"] if d["id"] == deck_id)
        assert "updated_at" in deck
        assert deck["updated_at"] is not None
