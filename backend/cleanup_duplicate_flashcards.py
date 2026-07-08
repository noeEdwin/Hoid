from __future__ import annotations

from collections import defaultdict

from sqlalchemy import text
from sqlmodel import Session, select

from app.core.database import engine
from app.models.flashcard import Flashcard, UserVocabularyState
from app.services.flashcard_identity import flashcard_identity_from_record


def _merge_states(session: Session, canonical_id: str, duplicate_id: str) -> None:
    canonical = session.exec(
        select(UserVocabularyState).where(UserVocabularyState.flashcard_id == canonical_id)
    ).first()
    duplicate = session.exec(
        select(UserVocabularyState).where(UserVocabularyState.flashcard_id == duplicate_id)
    ).first()

    if not duplicate:
        return

    if not canonical:
        duplicate.flashcard_id = canonical_id
        session.add(duplicate)
        return

    latest = duplicate if duplicate.updated_at > canonical.updated_at else canonical
    canonical.srs_interval = max(canonical.srs_interval, duplicate.srs_interval)
    canonical.ease_factor = latest.ease_factor
    canonical.total_reviews = max(canonical.total_reviews, duplicate.total_reviews)
    canonical.total_failures = max(canonical.total_failures, duplicate.total_failures)
    canonical.consecutive_failures = latest.consecutive_failures
    canonical.consecutive_correct = latest.consecutive_correct
    canonical.difficulty_score = latest.difficulty_score
    canonical.updated_at = latest.updated_at
    session.add(canonical)
    session.delete(duplicate)


def _choose_canonical(session: Session, cards: list[Flashcard]) -> Flashcard:
    def sort_key(card: Flashcard) -> tuple[int, str, str]:
        state = session.exec(
            select(UserVocabularyState).where(UserVocabularyState.flashcard_id == card.id)
        ).first()
        reviews = state.total_reviews if state else 0
        return (-reviews, card.created_at.isoformat(), card.id)

    return sorted(cards, key=sort_key)[0]


def cleanup_duplicate_flashcards() -> int:
    removed = 0
    with Session(engine) as session:
        cards = session.exec(select(Flashcard)).all()
        groups: dict[tuple[str, str, str | None, str | None, str | None, str | None, str | None, str | None], list[Flashcard]] = defaultdict(list)
        for card in cards:
            groups[flashcard_identity_from_record(card)].append(card)

        for group in groups.values():
            if len(group) < 2:
                continue
            canonical = _choose_canonical(session, group)
            for duplicate in group:
                if duplicate.id == canonical.id:
                    continue
                if not canonical.audio_path and duplicate.audio_path:
                    canonical.audio_path = duplicate.audio_path
                if not canonical.image_path and duplicate.image_path:
                    canonical.image_path = duplicate.image_path
                session.exec(
                    select(UserVocabularyState).where(UserVocabularyState.flashcard_id == canonical.id)
                ).first()
                _merge_states(session, canonical.id, duplicate.id)
                session.execute(
                    text("UPDATE shadowing_media SET flashcard_id = :canonical_id WHERE flashcard_id = :duplicate_id"),
                    {"canonical_id": canonical.id, "duplicate_id": duplicate.id},
                )
                session.execute(
                    text("UPDATE turn_evaluation SET target_flashcard_id = :canonical_id WHERE target_flashcard_id = :duplicate_id"),
                    {"canonical_id": canonical.id, "duplicate_id": duplicate.id},
                )
                session.delete(duplicate)
                removed += 1
            session.add(canonical)

        session.commit()
    return removed


if __name__ == "__main__":
    count = cleanup_duplicate_flashcards()
    print(f"Removed {count} duplicate flashcards.")
