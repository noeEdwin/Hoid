"""Seed HSK vocabulary into the database."""
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Session, select

from app.core.database import engine, init_db
from app.models.flashcard import Deck, Flashcard, UserVocabularyState

logger = logging.getLogger(__name__)

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
            logger.info("Deck '%s' already exists with id %s", DECK_NAME, existing.id)
            count = session.exec(
                select(Flashcard).where(Flashcard.deck_id == existing.id)
            ).all()
            logger.info("  -> %d cards already in deck", len(count))
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
        logger.info("Created deck '%s' with %d cards (id: %s)", DECK_NAME, len(cards), deck.id)


if __name__ == "__main__":
    seed_vocabulary()
