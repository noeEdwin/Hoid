from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.flashcard import Deck, Flashcard, UserVocabularyState


class TestListDecks:
    def test_list_empty_returns_empty_decks(self, client: TestClient) -> None:
        result = client.get("/api/decks").json()
        assert result == {"decks": []}

    def test_list_returns_wrapped_response(self, client: TestClient) -> None:
        result = client.get("/api/decks").json()
        assert "decks" in result
        assert isinstance(result["decks"], list)

    def test_list_multiple_decks(
        self, client: TestClient, db_session: Session
    ) -> None:
        for name in ["Deck A", "Deck B", "Deck C"]:
            db_session.add(Deck(name=name))
        db_session.commit()

        result = client.get("/api/decks").json()
        assert len(result["decks"]) == 3
        names = {d["name"] for d in result["decks"]}
        assert names == {"Deck A", "Deck B", "Deck C"}

    def test_deck_includes_updated_at(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Timestamp Deck")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        result = client.get("/api/decks").json()
        d = result["decks"][0]
        assert "updated_at" in d
        assert "created_at" in d


class TestCreateDeck:
    def test_create_returns_201(self, client: TestClient) -> None:
        r = client.post("/api/decks", json={"name": "New Deck"})
        assert r.status_code == 201

    def test_create_returns_deck_with_id(self, client: TestClient) -> None:
        data = client.post("/api/decks", json={"name": "New Deck"}).json()
        assert "id" in data
        assert data["name"] == "New Deck"

    def test_create_with_description(self, client: TestClient) -> None:
        data = client.post("/api/decks", json={
            "name": "Described Deck",
            "description": "A test deck",
        }).json()
        assert data["description"] == "A test deck"


class TestUpdateDeck:
    def test_update_name(self, client: TestClient, db_session: Session) -> None:
        deck = Deck(name="Old Name")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        r = client.put(f"/api/decks/{deck.id}", json={"name": "New Name"})
        assert r.status_code == 200
        assert r.json()["name"] == "New Name"

    def test_update_description(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Deck", description="Old desc")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        r = client.put(f"/api/decks/{deck.id}", json={
            "name": "Deck",
            "description": "New desc",
        })
        assert r.json()["description"] == "New desc"

    def test_update_nonexistent(self, client: TestClient) -> None:
        bad_id = str(uuid.uuid4())
        r = client.put(f"/api/decks/{bad_id}", json={"name": "nope"})
        assert r.status_code == 404

    def test_update_sets_updated_at(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Deck")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)
        original_updated = deck.updated_at

        client.put(f"/api/decks/{deck.id}", json={"name": "Updated"})

        db_session.refresh(deck)
        assert deck.updated_at >= original_updated


class TestDeleteDeck:
    def test_delete_returns_200(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Delete Me")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        r = client.delete(f"/api/decks/{deck.id}")
        assert r.status_code == 200
        assert r.json()["status"] == "deleted"

    def test_delete_removes_deck(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Delete Me")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        client.delete(f"/api/decks/{deck.id}")
        result = client.get("/api/decks").json()
        assert len(result["decks"]) == 0

    def test_delete_cascades_flashcards_and_states(
        self, client: TestClient, db_session: Session
    ) -> None:
        deck = Deck(name="Cascade Deck")
        db_session.add(deck)
        db_session.commit()
        db_session.refresh(deck)

        from app.models.flashcard import Flashcard

        fc = Flashcard(deck_id=deck.id, sentence="test", answer="test")
        db_session.add(fc)
        db_session.commit()
        db_session.refresh(fc)

        state = UserVocabularyState(flashcard_id=fc.id)
        db_session.add(state)
        db_session.commit()

        client.delete(f"/api/decks/{deck.id}")

        remaining = db_session.exec(select(Flashcard).where(Flashcard.deck_id == deck.id)).all()
        assert len(remaining) == 0

        remaining_states = db_session.exec(
            select(UserVocabularyState).where(
                UserVocabularyState.flashcard_id == fc.id
            )
        ).all()
        assert len(remaining_states) == 0

    def test_delete_nonexistent(self, client: TestClient) -> None:
        bad_id = str(uuid.uuid4())
        r = client.delete(f"/api/decks/{bad_id}")
        assert r.status_code == 404
