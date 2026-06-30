"""Seed HSK vocabulary into the database."""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.models.flashcard import Deck, Flashcard, UserVocabularyState

SEED_FILE = Path(__file__).parent / "seed_data" / "hsk-vocabulary.json"
DECK_NAME = "HSK Vocabulary"
DECK_DESCRIPTION = "HSK 1-3 vocabulary practice cards"


def seed_vocabulary():
    init_db()

    with Session(engine) as session:
        existing = session.exec(
            select(Deck).where(Deck.name == DECK_NAME)
        ).first()

        if existing:
            print(f"Deck '{DECK_NAME}' already exists with id {existing.id}")
            count = session.exec(
                select(Flashcard).where(Flashcard.deck_id == existing.id)
            ).all()
            print(f"  -> {len(count)} cards already in deck")
            return

        deck = Deck(name=DECK_NAME, description=DECK_DESCRIPTION)
        session.add(deck)
        session.flush()

        with open(SEED_FILE) as f:
            cards = json.load(f)

        for card_data in cards:
            flashcard = Flashcard(
                deck_id=deck.id,
                card_type="cloze_deletion",
                sentence=card_data["sentence"],
                sentence_pinyin=card_data["sentence_pinyin"],
                answer=card_data["answer"],
                answer_pinyin=card_data["answer_pinyin"],
                context=card_data.get("context"),
                context_pinyin=card_data.get("context_pinyin"),
                image_path=card_data.get("image_path"),
            )
            session.add(flashcard)
            session.flush()

            state = UserVocabularyState(flashcard_id=flashcard.id)
            session.add(state)

        session.commit()
        print(f"Created deck '{DECK_NAME}' with {len(cards)} cards (id: {deck.id})")


if __name__ == "__main__":
    seed_vocabulary()
