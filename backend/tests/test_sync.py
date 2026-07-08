from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import text
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

    def test_push_maps_duplicate_content_to_canonical_flashcard(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Test Deck")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        existing = Flashcard(
            deck_id=deck.id,
            card_type="cloze_deletion",
            sentence="我___你",
            sentence_pinyin="wǒ ___ nǐ",
            answer="爱",
            answer_pinyin="ài",
            context="example",
            context_pinyin="example",
        )
        db_session.add(existing)
        db_session.commit()
        db_session.refresh(existing)

        duplicate_id = str(uuid.uuid4())
        result = client.post("/api/sync/push", json={
            "decks": [],
            "flashcards": [{
                "id": duplicate_id,
                "deck_id": deck.id,
                "card_type": "cloze_deletion",
                "sentence": "我___你",
                "sentence_pinyin": "WǑ ___ NǏ",
                "answer": "爱",
                "answer_pinyin": "ÀI",
                "context": "example",
                "context_pinyin": "example",
            }],
            "vocabulary_states": [{
                "flashcard_id": duplicate_id,
                "srs_interval": 3,
                "ease_factor": 2.6,
                "total_reviews": 2,
                "total_failures": 0,
                "consecutive_failures": 0,
                "consecutive_correct": 2,
                "difficulty_score": 0.2,
            }],
            "pending_reviews": [{
                "id": str(uuid.uuid4()),
                "flashcard_id": duplicate_id,
                "is_correct": True,
                "response_time_ms": 1500,
            }],
        }).json()

        assert result["flashcards_upserted"] == 0
        assert result["states_upserted"] == 1
        assert result["reviews_processed"] == 1
        assert db_session.get(Flashcard, duplicate_id) is None

        cards = db_session.exec(select(Flashcard).where(Flashcard.deck_id == deck.id)).all()
        assert len(cards) == 1

        state = db_session.exec(
            select(UserVocabularyState).where(UserVocabularyState.flashcard_id == existing.id)
        ).first()
        assert state is not None
        assert state.total_reviews >= 1

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
                "id": str(uuid.uuid4()),
                "flashcard_id": fc.id,
                "is_correct": True,
                "response_time_ms": 2000,
            }],
        }).json()
        assert result["reviews_processed"] == 1
        assert len(result["processed_pending_review_ids"]) == 1

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
                {"id": str(uuid.uuid4()), "flashcard_id": fc.id, "is_correct": True, "response_time_ms": 2000},
                {"id": str(uuid.uuid4()), "flashcard_id": fc.id, "is_correct": False, "response_time_ms": 5000},
                {"id": str(uuid.uuid4()), "flashcard_id": fc.id, "is_correct": True, "response_time_ms": 1500},
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
                "id": str(uuid.uuid4()),
                "flashcard_id": str(uuid.uuid4()),
                "is_correct": True,
                "response_time_ms": 2000,
            }],
        }).json()
        assert result["reviews_processed"] == 0
        assert result["processed_pending_review_ids"] == []

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
        assert "processed_pending_review_ids" in result


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

    def test_pull_skips_orphan_vocab_states(
        self, client: TestClient, db_session: Session, create_flashcard
    ) -> None:
        fc = create_flashcard()
        db_session.exec(text("PRAGMA foreign_keys = OFF"))
        db_session.exec(
            text(
                "INSERT INTO user_vocabulary_state "
                "(id, flashcard_id, srs_interval, ease_factor, total_reviews, total_failures, "
                "consecutive_failures, consecutive_correct, difficulty_score, updated_at) "
                "VALUES (:id, :flashcard_id, 0, 2.5, 0, 0, 0, 0, 0.0, :updated_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "flashcard_id": str(uuid.uuid4()),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        db_session.commit()
        db_session.exec(text("PRAGMA foreign_keys = ON"))

        pull = client.get("/api/sync/pull").json()
        flashcard_ids = {f["id"] for f in pull["flashcards"]}
        assert fc.id in flashcard_ids
        assert all(v["flashcard_id"] in flashcard_ids for v in pull["vocabulary_states"])
