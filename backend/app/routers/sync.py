from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.flashcard import Deck, Flashcard, UserVocabularyState
from app.models.sync import SyncLog
from app.schemas.sync import (
    SyncDeckItem,
    SyncFlashcardItem,
    SyncPendingReviewItem,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncVocabStateItem,
)
from app.services.flashcard_identity import find_matching_flashcard
from app.schemas.review import ReviewRating
from app.services.srs import (
    calculate_mastery_correct,
    calculate_new_difficulty,
    calculate_new_ease,
    calculate_new_interval,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


def _parse_item_timestamp(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _is_incoming_stale(
    incoming_updated_at: str | None,
    existing_updated_at: datetime | None,
) -> bool:
    incoming_dt = _parse_item_timestamp(incoming_updated_at)
    if incoming_dt is None or existing_updated_at is None:
        return False
    return incoming_dt <= existing_updated_at.replace(tzinfo=None)


def _upsert_deck(session: Session, item: SyncDeckItem) -> bool:
    existing = session.get(Deck, item.id)
    if existing:
        if _is_incoming_stale(item.updated_at, existing.updated_at):
            return False
        existing.name = item.name
        existing.description = item.description
        existing.created_at = _parse_item_timestamp(item.created_at) or existing.created_at
        existing.updated_at = _parse_item_timestamp(item.updated_at) or datetime.utcnow()
        session.add(existing)
        return False
    session.add(
        Deck(
            id=item.id,
            name=item.name,
            description=item.description,
            created_at=_parse_item_timestamp(item.created_at) or datetime.utcnow(),
            updated_at=_parse_item_timestamp(item.updated_at) or datetime.utcnow(),
        )
    )
    return True


def _apply_flashcard_sync_item(target: Flashcard, item: SyncFlashcardItem) -> None:
    target.deck_id = item.deck_id
    target.card_type = item.card_type
    target.sentence = item.sentence
    target.sentence_pinyin = item.sentence_pinyin
    target.answer = item.answer
    target.answer_pinyin = item.answer_pinyin
    target.context = item.context
    target.context_pinyin = item.context_pinyin
    target.image_path = item.image_path
    target.audio_path = item.audio_path
    target.created_at = _parse_item_timestamp(item.created_at) or target.created_at
    target.updated_at = _parse_item_timestamp(item.updated_at) or datetime.utcnow()


def _upsert_flashcard(session: Session, item: SyncFlashcardItem) -> tuple[bool, str]:
    existing = session.get(Flashcard, item.id)
    if existing:
        if _is_incoming_stale(item.updated_at, existing.updated_at):
            return False, existing.id
        _apply_flashcard_sync_item(existing, item)
        session.add(existing)
        return False, existing.id

    duplicate = find_matching_flashcard(
        session,
        deck_id=item.deck_id,
        card_type=item.card_type,
        sentence=item.sentence,
        sentence_pinyin=item.sentence_pinyin,
        answer=item.answer,
        answer_pinyin=item.answer_pinyin,
        context=item.context,
        context_pinyin=item.context_pinyin,
    )
    if duplicate:
        if _is_incoming_stale(item.updated_at, duplicate.updated_at):
            return False, duplicate.id
        _apply_flashcard_sync_item(duplicate, item)
        session.add(duplicate)
        return False, duplicate.id

    created = Flashcard(id=item.id)
    _apply_flashcard_sync_item(created, item)
    session.add(created)
    return True, created.id


def _upsert_vocab_state(session: Session, item: SyncVocabStateItem) -> bool:
    existing = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == item.flashcard_id
        )
    ).first()
    if existing:
        if _is_incoming_stale(item.updated_at, existing.updated_at):
            return False
        existing.srs_interval = item.srs_interval
        existing.ease_factor = item.ease_factor
        existing.total_reviews = item.total_reviews
        existing.total_failures = item.total_failures
        existing.consecutive_failures = item.consecutive_failures
        existing.consecutive_correct = item.consecutive_correct
        existing.difficulty_score = item.difficulty_score
        existing.last_reviewed_at = _parse_item_timestamp(item.last_reviewed_at)
        existing.next_review_at = _parse_item_timestamp(item.next_review_at)
        existing.updated_at = _parse_item_timestamp(item.updated_at) or datetime.utcnow()
        session.add(existing)
        return False
    state = UserVocabularyState(
        flashcard_id=item.flashcard_id,
        srs_interval=item.srs_interval,
        ease_factor=item.ease_factor,
        total_reviews=item.total_reviews,
        total_failures=item.total_failures,
        consecutive_failures=item.consecutive_failures,
        consecutive_correct=item.consecutive_correct,
        difficulty_score=item.difficulty_score,
        last_reviewed_at=_parse_item_timestamp(item.last_reviewed_at),
        next_review_at=_parse_item_timestamp(item.next_review_at),
        updated_at=_parse_item_timestamp(item.updated_at) or datetime.utcnow(),
    )
    session.add(state)
    return True


def _process_pending_review(session: Session, review: SyncPendingReviewItem) -> bool:
    flashcard = session.get(Flashcard, review.flashcard_id)
    if not flashcard:
        logger.warning("Pending review for nonexistent flashcard %s, skipping", review.flashcard_id)
        return False

    state = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == review.flashcard_id
        )
    ).first()
    if not state:
        state = UserVocabularyState(flashcard_id=review.flashcard_id)
        session.add(state)
        session.flush()

    rating = ReviewRating.good if review.is_correct else ReviewRating.hard

    state.consecutive_correct = calculate_mastery_correct(
        state.consecutive_correct, rating
    )
    state.srs_interval = calculate_new_interval(
        state.srs_interval,
        state.ease_factor,
        state.difficulty_score,
        rating,
        state.consecutive_correct,
    )
    state.ease_factor = calculate_new_ease(state.ease_factor, rating)
    state.difficulty_score = calculate_new_difficulty(
        state.difficulty_score,
        rating,
        review.response_time_ms,
        state.consecutive_failures,
    )
    state.total_reviews += 1
    if not review.is_correct:
        state.total_failures += 1
        state.consecutive_failures += 1
    else:
        state.consecutive_failures = 0
    state.updated_at = datetime.utcnow()
    state.last_reviewed_at = state.updated_at
    state.next_review_at = state.updated_at + timedelta(days=state.srs_interval)

    session.add(state)
    return True


@router.post("/sync/push", response_model=SyncPushResponse)
def sync_push(
    data: SyncPushRequest,
    session: Session = Depends(get_session),
) -> SyncPushResponse:
    decks_upserted = 0
    flashcards_upserted = 0
    states_upserted = 0
    reviews_processed = 0
    processed_pending_review_ids: list[str] = []
    flashcard_id_map: dict[str, str] = {}

    for deck_item in data.decks:
        if _upsert_deck(session, deck_item):
            decks_upserted += 1

    for fc_item in data.flashcards:
        created, canonical_id = _upsert_flashcard(session, fc_item)
        flashcard_id_map[fc_item.id] = canonical_id
        if created:
            flashcards_upserted += 1

    for vs_item in data.vocabulary_states:
        canonical_id = flashcard_id_map.get(vs_item.flashcard_id, vs_item.flashcard_id)
        # Pending events are authoritative for the normal local card identity.
        # A duplicate identity may still need its state migrated to the canonical card.
        if canonical_id == vs_item.flashcard_id and any(
            review.flashcard_id == vs_item.flashcard_id for review in data.pending_reviews
        ):
            continue
        target_item = (
            vs_item
            if canonical_id == vs_item.flashcard_id
            else vs_item.model_copy(update={"flashcard_id": canonical_id})
        )
        if _upsert_vocab_state(session, target_item):
            states_upserted += 1

    for review in data.pending_reviews:
        canonical_id = flashcard_id_map.get(review.flashcard_id, review.flashcard_id)
        target_review = (
            review
            if canonical_id == review.flashcard_id
            else review.model_copy(update={"flashcard_id": canonical_id})
        )
        if _process_pending_review(session, target_review):
            reviews_processed += 1
            processed_pending_review_ids.append(review.id)

    log = SyncLog(
        direction="push",
        flashcards_upserted=flashcards_upserted,
        states_upserted=states_upserted,
        last_sync_at=data.last_sync_at,
    )
    session.add(log)
    session.commit()

    return SyncPushResponse(
        decks_upserted=decks_upserted,
        flashcards_upserted=flashcards_upserted,
        states_upserted=states_upserted,
        reviews_processed=reviews_processed,
        processed_pending_review_ids=processed_pending_review_ids,
    )


def _parse_iso_timestamp(ts: str | None) -> str | None:
    if not ts:
        return None
    try:
        ts_clean = ts.replace("Z", "+00:00")
        # FastAPI URL-decodes '+' as space, so "2099-01-01T00:00:00+00:00"
        # arrives as "2099-01-01T00:00:00 00:00". Try to recover.
        try:
            dt = datetime.fromisoformat(ts_clean)
        except ValueError:
            # Last 6 chars are " HH:MM" — replace with +HH:MM
            if len(ts_clean) >= 6 and ts_clean[-6] == " ":
                ts_clean = ts_clean[:-6] + "+" + ts_clean[-5:]
            dt = datetime.fromisoformat(ts_clean)
        return dt.replace(tzinfo=None).isoformat()
    except (ValueError, TypeError):
        return None


@router.get("/sync/pull", response_model=SyncPullResponse)
def sync_pull(
    since: str | None = Query(None),
    session: Session = Depends(get_session),
) -> SyncPullResponse:
    since_str = _parse_iso_timestamp(since)

    deck_query = select(Deck)
    flashcard_query = select(Flashcard).join(Deck, Flashcard.deck_id == Deck.id)
    vocab_query = (
        select(UserVocabularyState)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .join(Deck, Flashcard.deck_id == Deck.id)
    )

    if since_str:
        deck_query = deck_query.where(Deck.updated_at > since_str)
        flashcard_query = flashcard_query.where(Flashcard.updated_at > since_str)
        vocab_query = vocab_query.where(UserVocabularyState.updated_at > since_str)

    decks = list(session.exec(deck_query).all())
    flashcards = list(session.exec(flashcard_query).all())
    vocab_states = list(session.exec(vocab_query).all())

    now = datetime.utcnow().isoformat()

    log = SyncLog(
        direction="pull",
        flashcards_upserted=0,
        states_upserted=0,
    )
    session.add(log)
    session.commit()

    return SyncPullResponse(
        decks=[
            SyncDeckItem(
                id=d.id,
                name=d.name,
                description=d.description,
                created_at=d.created_at.isoformat() if d.created_at else None,
                updated_at=d.updated_at.isoformat() if d.updated_at else None,
            )
            for d in decks
        ],
        flashcards=[
            SyncFlashcardItem(
                id=f.id,
                deck_id=f.deck_id,
                card_type=f.card_type,
                sentence=f.sentence,
                sentence_pinyin=f.sentence_pinyin,
                answer=f.answer,
                answer_pinyin=f.answer_pinyin,
                context=f.context,
                context_pinyin=f.context_pinyin,
                image_path=f.image_path,
                audio_path=f.audio_path,
                created_at=f.created_at.isoformat() if f.created_at else None,
                updated_at=f.updated_at.isoformat() if f.updated_at else None,
            )
            for f in flashcards
        ],
        vocabulary_states=[
            SyncVocabStateItem(
                flashcard_id=v.flashcard_id,
                srs_interval=v.srs_interval,
                ease_factor=v.ease_factor,
                total_reviews=v.total_reviews,
                total_failures=v.total_failures,
                consecutive_failures=v.consecutive_failures,
                consecutive_correct=v.consecutive_correct,
                difficulty_score=v.difficulty_score,
                last_reviewed_at=v.last_reviewed_at.isoformat() if v.last_reviewed_at else None,
                next_review_at=v.next_review_at.isoformat() if v.next_review_at else None,
                updated_at=v.updated_at.isoformat() if v.updated_at else None,
            )
            for v in vocab_states
        ],
        synced_at=now,
    )
