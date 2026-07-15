from __future__ import annotations

import argparse
import logging
from collections import defaultdict

from sqlmodel import Session, delete, select

from app.core.database import engine
from app.models.flashcard import Deck, Flashcard, UserVocabularyState

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def normalize(value: str | None, lowercase: bool = False) -> str | None:
    if value is None:
        return None
    result = value.strip()
    return result.lower() if lowercase else result


def deck_key(deck: Deck) -> tuple[str | None, str | None]:
    return normalize(deck.name, True), normalize(deck.description, True)


def card_key(card: Flashcard) -> tuple[str | None, ...]:
    return (
        normalize(card.card_type) or "cloze_deletion",
        normalize(card.sentence),
        normalize(card.sentence_pinyin, True),
        normalize(card.answer),
        normalize(card.answer_pinyin, True),
        normalize(card.context),
        normalize(card.context_pinyin, True),
    )


def merge_states(
    session: Session,
    canonical: Flashcard,
    duplicate: Flashcard,
) -> None:
    canonical_state = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == canonical.id
        )
    ).first()
    duplicate_state = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == duplicate.id
        )
    ).first()
    if not duplicate_state:
        return
    if not canonical_state:
        duplicate_state.flashcard_id = canonical.id
        session.add(duplicate_state)
        return

    latest = max(
        (canonical_state, duplicate_state),
        key=lambda state: state.updated_at,
    )
    canonical_state.srs_interval = max(
        canonical_state.srs_interval, duplicate_state.srs_interval
    )
    canonical_state.total_reviews = max(
        canonical_state.total_reviews, duplicate_state.total_reviews
    )
    canonical_state.total_failures = max(
        canonical_state.total_failures, duplicate_state.total_failures
    )
    canonical_state.ease_factor = latest.ease_factor
    canonical_state.consecutive_failures = latest.consecutive_failures
    canonical_state.consecutive_correct = latest.consecutive_correct
    canonical_state.difficulty_score = latest.difficulty_score
    canonical_state.last_reviewed_at = latest.last_reviewed_at
    canonical_state.next_review_at = latest.next_review_at
    canonical_state.updated_at = latest.updated_at
    session.add(canonical_state)
    session.delete(duplicate_state)


def cleanup(apply_changes: bool) -> tuple[int, int]:
    with Session(engine) as session:
        decks = session.exec(select(Deck)).all()
        groups: dict[tuple[str | None, str | None], list[Deck]] = defaultdict(list)
        for deck in decks:
            groups[deck_key(deck)].append(deck)

        duplicate_decks = 0
        duplicate_cards = 0
        for group in groups.values():
            if len(group) < 2:
                continue
            canonical = sorted(group, key=lambda item: (item.created_at, item.id))[0]
            for duplicate_deck in group:
                if duplicate_deck.id == canonical.id:
                    continue
                duplicate_decks += 1
                canonical_cards = session.exec(
                    select(Flashcard).where(Flashcard.deck_id == canonical.id)
                ).all()
                canonical_by_key = {card_key(card): card for card in canonical_cards}
                duplicate_cards_for_deck = session.exec(
                    select(Flashcard).where(Flashcard.deck_id == duplicate_deck.id)
                ).all()
                for duplicate_card in duplicate_cards_for_deck:
                    matching = canonical_by_key.get(card_key(duplicate_card))
                    if matching:
                        merge_states(session, matching, duplicate_card)
                        session.delete(duplicate_card)
                        duplicate_cards += 1
                    else:
                        duplicate_card.deck_id = canonical.id
                        session.add(duplicate_card)
                        canonical_by_key[card_key(duplicate_card)] = duplicate_card
                session.execute(delete(Deck).where(Deck.id == duplicate_deck.id))

        if apply_changes:
            session.commit()
        else:
            session.rollback()
        return duplicate_decks, duplicate_cards


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="apply the merge; otherwise only report what would change",
    )
    args = parser.parse_args()
    decks, cards = cleanup(args.apply)
    action = "Merged" if args.apply else "Would merge"
    logger.info("%s %d duplicate decks and %d duplicate cards", action, decks, cards)


if __name__ == "__main__":
    main()
