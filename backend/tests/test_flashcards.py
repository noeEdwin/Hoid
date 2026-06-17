from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.flashcard import Flashcard, UserVocabularyState


class TestCreateFlashcard:
    def test_create_returns_201(self, client: TestClient) -> None:
        r = client.post("/api/flashcards", json={
            "character": "咖啡",
            "pinyin": "kā fēi",
            "meaning": "coffee",
            "grammar_type": "noun",
        })
        assert r.status_code == 201

    def test_create_returns_all_fields(self, client: TestClient) -> None:
        r = client.post("/api/flashcards", json={
            "character": "咖啡",
            "pinyin": "kā fēi",
            "meaning": "coffee",
            "grammar_type": "noun",
        })
        data = r.json()
        assert data["character"] == "咖啡"
        assert data["pinyin"] == "kā fēi"
        assert data["meaning"] == "coffee"
        assert data["grammar_type"] == "noun"
        assert "id" in data
        assert "created_at" in data


class TestListFlashcards:
    def test_list_empty(self, client: TestClient) -> None:
        r = client.get("/api/flashcards")
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_list_returns_created(self, client: TestClient, create_flashcard) -> None:
        create_flashcard()
        r = client.get("/api/flashcards")
        assert r.json()["total"] == 1

    def test_filter_by_grammar_type(self, client: TestClient, create_flashcard) -> None:
        create_flashcard(character="朋友", grammar_type="noun")
        create_flashcard(character="跑", grammar_type="verb")
        r = client.get("/api/flashcards?grammar_type=noun")
        assert r.json()["total"] == 1
        assert r.json()["flashcards"][0]["character"] == "朋友"

    def test_search_by_character(self, client: TestClient, create_flashcard) -> None:
        create_flashcard(character="咖啡")
        create_flashcard(character="朋友")
        r = client.get("/api/flashcards?search=咖啡")
        assert r.json()["total"] == 1

    def test_search_by_meaning(self, client: TestClient, create_flashcard) -> None:
        create_flashcard(meaning="coffee")
        create_flashcard(meaning="friend")
        r = client.get("/api/flashcards?search=coffee")
        assert r.json()["total"] == 1


class TestUpdateFlashcard:
    def test_update_partial(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        r = client.put(f"/api/flashcards/{fc.id}", json={"meaning": "coffee (noun)"})
        assert r.status_code == 200
        assert r.json()["meaning"] == "coffee (noun)"
        assert r.json()["character"] == "朋友"

    def test_update_nonexistent(self, client: TestClient) -> None:
        bad_id = str(uuid.uuid4())
        r = client.put(f"/api/flashcards/{bad_id}", json={"meaning": "nope"})
        assert r.status_code == 404


class TestDeleteFlashcard:
    def test_delete_returns_200(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        r = client.delete(f"/api/flashcards/{fc.id}")
        assert r.status_code == 200
        assert r.json()["status"] == "deleted"

    def test_delete_removes_card(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        client.delete(f"/api/flashcards/{fc.id}")
        r = client.get("/api/flashcards")
        assert r.json()["total"] == 0

    def test_delete_cascades_vocab_state(
        self, client: TestClient, create_flashcard, db_session: Session
    ) -> None:
        fc = create_flashcard()
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc.id),
            "review_rating": "hard",
            "response_time_ms": 3000,
        })
        client.delete(f"/api/flashcards/{fc.id}")
        from sqlmodel import select
        state = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).first()
        assert state is None

    def test_delete_nonexistent(self, client: TestClient) -> None:
        bad_id = str(uuid.uuid4())
        r = client.delete(f"/api/flashcards/{bad_id}")
        assert r.status_code == 404
