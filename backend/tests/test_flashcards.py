from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.flashcard import Deck, Flashcard, UserVocabularyState


class TestCreateFlashcard:
    def test_create_returns_201(self, client: TestClient, db_session: Session) -> None:
        deck = Deck(name="Test Deck")
        db_session.add(deck)
        db_session.commit()
        r = client.post("/api/flashcards", json={
            "deck_id": deck.id,
            "sentence": "我___你",
            "answer": "爱",
        })
        assert r.status_code == 201

    def test_create_returns_all_fields(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Test Deck")
        db_session.add(deck)
        db_session.commit()
        r = client.post("/api/flashcards", json={
            "deck_id": deck.id,
            "sentence": "我___你",
            "sentence_pinyin": "wǒ ài nǐ",
            "answer": "爱",
            "answer_pinyin": "ài",
            "context": "A simple declaration of love.",
        })
        data = r.json()
        assert data["sentence"] == "我___你"
        assert data["sentence_pinyin"] == "wǒ ài nǐ"
        assert data["answer"] == "爱"
        assert data["answer_pinyin"] == "ài"
        assert data["context"] == "A simple declaration of love."
        assert data["card_type"] == "cloze_deletion"
        assert data["deck_id"] == deck.id
        assert "id" in data
        assert "created_at" in data

    def test_create_reuses_existing_duplicate_content(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Import Deck")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        first = client.post("/api/flashcards", json={
            "deck_id": deck.id,
            "sentence": "我___你",
            "sentence_pinyin": "wǒ ___ nǐ",
            "answer": "爱",
            "answer_pinyin": "ài",
            "context": "example",
            "context_pinyin": "example",
        }).json()
        second = client.post("/api/flashcards", json={
            "deck_id": deck.id,
            "sentence": " 我___你 ",
            "sentence_pinyin": "WǑ ___ NǏ",
            "answer": "爱",
            "answer_pinyin": "ÀI",
            "context": "example",
            "context_pinyin": "example",
        }).json()

        assert first["id"] == second["id"]
        cards = db_session.exec(select(Flashcard).where(Flashcard.deck_id == deck.id)).all()
        assert len(cards) == 1


class TestBulkCreateFlashcards:
    def test_bulk_skips_duplicate_content(
        self, client: TestClient, db_session: Session
    ) -> None:
        from app.models.flashcard import Deck

        deck = Deck(name="Bulk Deck")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        result = client.post(
            f"/api/decks/{deck.id}/flashcards/bulk",
            json={
                "flashcards": [
                    {"sentence": "我___你", "answer": "爱"},
                    {"sentence": "我___你", "answer": "爱"},
                ]
            },
        ).json()

        assert result["created"] == 1
        assert result["errors"] == ["Card 2: duplicate skipped"]


class TestListFlashcards:
    def test_list_empty(self, client: TestClient) -> None:
        r = client.get("/api/flashcards")
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_list_returns_created(self, client: TestClient, create_flashcard) -> None:
        create_flashcard()
        r = client.get("/api/flashcards")
        assert r.json()["total"] == 1

    def test_search_by_sentence(self, client: TestClient, create_flashcard) -> None:
        create_flashcard(sentence="我___你", answer="爱")
        create_flashcard(sentence="他是我的___", answer="朋友")
        r = client.get("/api/flashcards?search=咖啡")
        assert r.json()["total"] == 0
        r = client.get("/api/flashcards?search=我___你")
        assert r.json()["total"] == 1

    def test_search_by_answer(self, client: TestClient, create_flashcard) -> None:
        create_flashcard(sentence="我___你", answer="爱")
        create_flashcard(sentence="他是我的___", answer="朋友")
        r = client.get("/api/flashcards?search=爱")
        assert r.json()["total"] == 1


class TestUpdateFlashcard:
    def test_update_partial(self, client: TestClient, create_flashcard) -> None:
        fc = create_flashcard()
        r = client.put(f"/api/flashcards/{fc.id}", json={"answer": "喜欢"})
        assert r.status_code == 200
        assert r.json()["answer"] == "喜欢"
        assert r.json()["sentence"] == "我___你"

    def test_update_nonexistent(self, client: TestClient) -> None:
        bad_id = str(uuid.uuid4())
        r = client.put(f"/api/flashcards/{bad_id}", json={"answer": "nope"})
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
        client.post(f"/api/flashcards/{fc.id}/review", json={
            "flashcard_id": str(fc.id),
            "is_correct": False,
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
