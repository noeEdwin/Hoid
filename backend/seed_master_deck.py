from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

BACKEND_URL = "http://127.0.0.1:8000"
HSK_DATA = Path(__file__).resolve().parent.parent / "mobile" / "data" / "hsk-course.json"
MASTER_DECK_NAME = "HSK Master Deck"
FIXED_DECK_ID = "a0000000-0000-0000-0000-000000000001"


def main() -> None:
    hsk = json.loads(HSK_DATA.read_text())

    existing = httpx.get(f"{BACKEND_URL}/api/decks", timeout=10).json()
    for d in existing.get("decks", []):
        if d["name"] == MASTER_DECK_NAME:
            print(f"Master deck already exists (id={d['id'][:8]}..., {d.get('flashcard_count', '?')} cards). Skipping.")
            return

    now = datetime.now(timezone.utc).isoformat()

    decks = [
        {
            "id": FIXED_DECK_ID,
            "name": MASTER_DECK_NAME,
            "description": "All HSK vocabulary across all topics",
            "created_at": now,
            "updated_at": now,
        }
    ]

    flashcards = []
    vocab_states = []

    for topic, cards in hsk.items():
        for i, card in enumerate(cards):
            fc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{FIXED_DECK_ID}/{topic}/{i}"))
            flashcards.append({
                "id": fc_id,
                "deck_id": FIXED_DECK_ID,
                "card_type": "cloze_deletion",
                "sentence": card["sentence"],
                "sentence_pinyin": card["sentence_pinyin"],
                "answer": card["answer"],
                "answer_pinyin": card["answer_pinyin"],
                "context": card.get("context"),
                "context_pinyin": card.get("context_pinyin"),
                "image_path": card.get("image_path"),
                "created_at": now,
                "updated_at": now,
            })
            vocab_states.append({
                "flashcard_id": fc_id,
                "srs_interval": 0,
                "ease_factor": 2.5,
                "total_reviews": 0,
                "total_failures": 0,
                "consecutive_failures": 0,
                "consecutive_correct": 0,
                "difficulty_score": 0.0,
                "updated_at": now,
            })

    payload = {
        "decks": decks,
        "flashcards": flashcards,
        "vocabulary_states": vocab_states,
        "pending_reviews": [],
    }

    resp = httpx.post(f"{BACKEND_URL}/api/sync/push", json=payload, timeout=30)
    resp.raise_for_status()
    result = resp.json()
    print(f"Master deck seeded: {result}")


if __name__ == "__main__":
    main()
