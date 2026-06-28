from __future__ import annotations

from fastapi.testclient import TestClient


class TestDifficultyEndpoint:
    def test_empty_initially(self, client: TestClient) -> None:
        r = client.get("/api/vocabulary/difficulty")
        assert r.status_code == 200
        assert r.json()["difficult_tokens"] == []

    def test_returns_top_n(self, client: TestClient, create_flashcard) -> None:
        fc1 = create_flashcard(sentence="我___你", answer="爱")
        fc2 = create_flashcard(sentence="他是我的___", answer="朋友")
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
        r = client.get("/api/vocabulary/difficulty?n=1")
        tokens = r.json()["difficult_tokens"]
        assert len(tokens) == 1
        assert tokens[0]["answer"] == "朋友"

    def test_respects_n_parameter(self, client: TestClient, create_flashcard) -> None:
        for i in range(5):
            fc = create_flashcard(sentence=f"句子{i}", answer=f"词{i}")
            client.post(f"/api/flashcards/{fc.id}/review", json={
                "flashcard_id": str(fc.id),
                "is_correct": False,
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
        fc1 = create_flashcard(sentence="我___你", answer="爱")
        fc2 = create_flashcard(sentence="他是我的___", answer="朋友")
        client.post(f"/api/flashcards/{fc1.id}/review", json={
            "flashcard_id": str(fc1.id),
            "is_correct": True,
            "response_time_ms": 1000,
        })
        for _ in range(5):
            client.post(f"/api/flashcards/{fc2.id}/review", json={
                "flashcard_id": str(fc2.id),
                "is_correct": False,
                "response_time_ms": 5000,
            })
        r = client.get("/api/vocabulary/profile?threshold=0.5")
        data = r.json()
        known_answers = [w["answer"] for w in data["known_words"]]
        assert "爱" in known_answers
        assert "朋友" not in known_answers

    def test_total_cards_counts_all(self, client: TestClient, create_flashcard) -> None:
        for i in range(5):
            create_flashcard(sentence=f"句子{i}", answer=f"词{i}")
        r = client.get("/api/vocabulary/profile")
        assert r.json()["total_cards"] == 5
