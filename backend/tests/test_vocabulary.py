from __future__ import annotations

from fastapi.testclient import TestClient


class TestDifficultyEndpoint:
    def test_empty_initially(self, client: TestClient) -> None:
        r = client.get("/api/vocabulary/difficulty")
        assert r.status_code == 200
        assert r.json()["difficult_tokens"] == []

    def test_returns_top_n(self, client: TestClient, create_flashcard) -> None:
        fc1 = create_flashcard(character="朋友", meaning="friend")
        fc2 = create_flashcard(character="咖啡", meaning="coffee")
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
        r = client.get("/api/vocabulary/difficulty?n=1")
        tokens = r.json()["difficult_tokens"]
        assert len(tokens) == 1
        assert tokens[0]["character"] == "咖啡"

    def test_respects_n_parameter(self, client: TestClient, create_flashcard) -> None:
        for i in range(5):
            fc = create_flashcard(character=f"字{i}", meaning=f"word{i}")
            client.post("/api/flashcards/review/submit", json={
                "flashcard_id": str(fc.id),
                "review_rating": "hard",
                "response_time_ms": 3000,
            })
        r = client.get("/api/vocabulary/difficulty?n=3")
        assert len(r.json()["difficult_tokens"]) == 3


class TestProfileEndpoint:
    def test_empty_initially(self, client: TestClient) -> None:
        r = client.get("/api/vocabulary/profile")
        assert r.status_code == 200
        assert r.json()["total_known"] == 0
        assert r.json()["total_cards"] == 0

    def test_filters_by_threshold(self, client: TestClient, create_flashcard) -> None:
        fc1 = create_flashcard(character="朋友", meaning="friend")
        fc2 = create_flashcard(character="咖啡", meaning="coffee")
        fc3 = create_flashcard(character="跑", meaning="run")
        client.post("/api/flashcards/review/submit", json={
            "flashcard_id": str(fc1.id),
            "review_rating": "easy",
            "response_time_ms": 1000,
        })
        for _ in range(5):
            client.post("/api/flashcards/review/submit", json={
                "flashcard_id": str(fc2.id),
                "review_rating": "hard",
                "response_time_ms": 5000,
            })
        r = client.get("/api/vocabulary/profile?threshold=0.5")
        data = r.json()
        known_chars = [w["character"] for w in data["known_words"]]
        assert "朋友" in known_chars
        assert "咖啡" not in known_chars

    def test_total_cards_counts_all(self, client: TestClient, create_flashcard) -> None:
        for i in range(5):
            create_flashcard(character=f"字{i}", meaning=f"word{i}")
        r = client.get("/api/vocabulary/profile")
        assert r.json()["total_cards"] == 5
