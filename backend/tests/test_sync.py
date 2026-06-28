#!/usr/bin/env python3
"""
Sync verification script.
Run from PC to test bidirectional sync between backend and mobile.

Usage:
  python tests/test_sync.py

Prerequisites:
  - Backend server running on http://localhost:8000 (or set TARS_API_URL)
  - Mobile app opened at least once (so performSync runs on startup)
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_BASE = os.environ.get("TARS_API_URL", "http://localhost:8000")


def api_get(path: str) -> dict:
    req = Request(f"{API_BASE}{path}", headers={"Content-Type": "application/json"})
    with urlopen(req) as resp:
        return json.loads(resp.read())


def api_post(path: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = Request(
        f"{API_BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req) as resp:
        return json.loads(resp.read())


def test_health() -> bool:
    print("1. Testing health endpoint...")
    result = api_get("/health")
    assert result["status"] == "ok", f"Unexpected: {result}"
    print("   PASS - Server is healthy")
    return True


def test_push_pc_data_to_backend() -> str:
    """Create data on PC (backend) via direct API — simulates PC-created content."""
    print("\n2. Creating deck on backend (PC-side)...")
    deck_name = f"Sync Test Deck {uuid.uuid4().hex[:6]}"
    deck = api_post("/api/decks", {"name": deck_name, "description": "Created by sync test"})
    deck_id = deck["id"]
    print(f"   Created deck: {deck_name} ({deck_id[:8]}...)")

    print("   Creating flashcards...")
    fc1 = api_post("/api/flashcards", {
        "deck_id": deck_id,
        "sentence": "今天天气很___",
        "sentence_pinyin": "jīn tiān tiān qì hěn...",
        "answer": "好",
        "answer_pinyin": "hǎo",
    })
    fc2 = api_post("/api/flashcards", {
        "deck_id": deck_id,
        "sentence": "我每天___咖啡",
        "sentence_pinyin": "wǒ měi tiān... kā fēi",
        "answer": "喝",
        "answer_pinyin": "hē",
    })
    print(f"   Created 2 flashcards: {fc1['answer']}, {fc2['answer']}")
    return deck_id


def test_pull_returns_pc_data(deck_id: str) -> bool:
    """Verify that pull returns the data we just created."""
    print("\n3. Pulling from backend to verify PC data...")
    pull = api_get("/api/sync/pull")

    deck_ids = [d["id"] for d in pull["decks"]]
    assert deck_id in deck_ids, f"Deck {deck_id} not found in pull response"

    deck_flashcards = [f for f in pull["flashcards"] if f["deck_id"] == deck_id]
    assert len(deck_flashcards) == 2, f"Expected 2 flashcards, got {len(deck_flashcards)}"
    print(f"   PASS - Pull returned deck with {len(deck_flashcards)} flashcards")
    return True


def test_push_mobile_data_to_backend() -> str:
    """Simulate mobile creating data and pushing to backend."""
    print("\n4. Pushing mobile-created data to backend...")
    mobile_deck_id = str(uuid.uuid4())
    mobile_fc_id = str(uuid.uuid4())

    result = api_post("/api/sync/push", {
        "decks": [{
            "id": mobile_deck_id,
            "name": "Mobile Created Deck",
            "description": "Created on phone",
        }],
        "flashcards": [{
            "id": mobile_fc_id,
            "deck_id": mobile_deck_id,
            "card_type": "cloze_deletion",
            "sentence": "这本书是___",
            "sentence_pinyin": "zhè běn shū shì...",
            "answer": "谁的",
            "answer_pinyin": "shuí de",
        }],
        "vocabulary_states": [{
            "flashcard_id": mobile_fc_id,
            "srs_interval": 1,
            "ease_factor": 2.5,
            "total_reviews": 1,
            "total_failures": 0,
            "consecutive_failures": 0,
            "consecutive_correct": 1,
            "difficulty_score": 0.1,
        }],
        "pending_reviews": [],
    })

    assert result["decks_upserted"] == 1, f"Expected 1 deck upserted, got {result['decks_upserted']}"
    assert result["flashcards_upserted"] == 1, f"Expected 1 flashcard upserted"
    assert result["states_upserted"] == 1, f"Expected 1 state upserted"
    print(f"   PASS - Push accepted: {result['decks_upserted']} deck, {result['flashcards_upserted']} flashcards, {result['states_upserted']} states")
    return mobile_deck_id


def test_pull_shows_mobile_data(mobile_deck_id: str) -> bool:
    """Verify the mobile data is now visible via pull."""
    print("\n5. Pulling to verify mobile data appeared on backend...")
    pull = api_get("/api/sync/pull")

    mobile_deck = next((d for d in pull["decks"] if d["id"] == mobile_deck_id), None)
    assert mobile_deck is not None, f"Mobile deck {mobile_deck_id} not found"
    assert mobile_deck["name"] == "Mobile Created Deck"

    deck_flashcards = [f for f in pull["flashcards"] if f["deck_id"] == mobile_deck_id]
    assert len(deck_flashcards) == 1, f"Expected 1 mobile flashcard, got {len(deck_flashcards)}"
    mobile_fc = deck_flashcards[0]
    assert mobile_fc["answer"] == "谁的"

    mobile_state = next(
        (v for v in pull["vocabulary_states"] if v["flashcard_id"] == mobile_fc["id"]),
        None,
    )
    assert mobile_state is not None, "Vocab state not found"
    assert mobile_state["consecutive_correct"] == 1
    print(f"   PASS - Mobile deck, flashcard, and vocab state all present")
    return True


def test_review_push() -> bool:
    """Simulate a mobile review being pushed."""
    print("\n6. Pushing a review result from mobile...")

    # Get an existing flashcard
    pull = api_get("/api/sync/pull")
    fc = pull["flashcards"][0]
    fc_id = fc["id"]

    result = api_post("/api/sync/push", {
        "decks": [],
        "flashcards": [],
        "vocabulary_states": [],
        "pending_reviews": [{
            "flashcard_id": fc_id,
            "is_correct": True,
            "response_time_ms": 2500,
        }],
    })

    assert result["reviews_processed"] == 1
    print(f"   PASS - Review processed for flashcard {fc['answer']}")
    return True


def main() -> None:
    print(f"=== Tars Sync Verification ===")
    print(f"API: {API_BASE}\n")

    try:
        test_health()
        deck_id = test_push_pc_data_to_backend()
        test_pull_returns_pc_data(deck_id)
        mobile_deck_id = test_push_mobile_data_to_backend()
        test_pull_shows_mobile_data(mobile_deck_id)
        test_review_push()

        print("\n=== ALL TESTS PASSED ===")
        print("Bidirectional sync is working correctly.")
        print("When the mobile app opens, performSync() will:")
        print("  1. Push local pending reviews to backend")
        print("  2. Pull latest decks/flashcards/states from backend")
    except (HTTPError, URLError) as e:
        print(f"\nFAILED: Cannot reach server at {API_BASE}")
        print(f"  Error: {e}")
        print(f"  Make sure the backend is running:")
        print(f"    cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000")
        sys.exit(1)
    except AssertionError as e:
        print(f"\nFAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nFAILED: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
