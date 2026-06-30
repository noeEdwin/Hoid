from __future__ import annotations

import logging
from datetime import datetime, timezone

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

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


def _upsert_deck(session: Session, item: SyncDeckItem) -> bool:
    existing = session.get(Deck, item.id)
    if existing:
        existing.name = item.name
        existing.description = item.description
        session.add(existing)
        return False
    deck = Deck(
        id=item.id,
        name=item.name,
        description=item.description,
    )
    session.add(deck)
    return True


def _upsert_flashcard(session: Session, item: SyncFlashcardItem) -> bool:
    existing = session.get(Flashcard, item.id)
    if existing:
        existing.sentence = item.sentence
        existing.sentence_pinyin = item.sentence_pinyin
        existing.answer = item.answer
        existing.answer_pinyin = item.answer_pinyin
        existing.context = item.context
        existing.context_pinyin = item.context_pinyin
        existing.image_path = item.image_path
        existing.audio_path = item.audio_path
        existing.card_type = item.card_type
        session.add(existing)
        return False
    flashcard = Flashcard(
        id=item.id,
        deck_id=item.deck_id,
        card_type=item.card_type,
        sentence=item.sentence,
        sentence_pinyin=item.sentence_pinyin,
        answer=item.answer,
        answer_pinyin=item.answer_pinyin,
        context=item.context,
        context_pinyin=item.context_pinyin,
        image_path=item.image_path,
        audio_path=item.audio_path,
    )
    session.add(flashcard)
    return True


def _upsert_vocab_state(session: Session, item: SyncVocabStateItem) -> bool:
    existing = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == item.flashcard_id
        )
    ).first()
    if existing:
        existing.srs_interval = item.srs_interval
        existing.ease_factor = item.ease_factor
        existing.total_reviews = item.total_reviews
        existing.total_failures = item.total_failures
        existing.consecutive_failures = item.consecutive_failures
        existing.consecutive_correct = item.consecutive_correct
        existing.difficulty_score = item.difficulty_score
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
    )
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

    for deck_item in data.decks:
        if _upsert_deck(session, deck_item):
            decks_upserted += 1

    for fc_item in data.flashcards:
        if _upsert_flashcard(session, fc_item):
            flashcards_upserted += 1

    for vs_item in data.vocabulary_states:
        if _upsert_vocab_state(session, vs_item):
            states_upserted += 1

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
    )


@router.get("/sync/pull", response_model=SyncPullResponse)
def sync_pull(
    since: str | None = Query(None),
    session: Session = Depends(get_session),
) -> SyncPullResponse:
    decks = list(session.exec(select(Deck)).all())
    flashcards = list(session.exec(select(Flashcard)).all())
    vocab_states = list(session.exec(select(UserVocabularyState)).all())

    now = datetime.now(timezone.utc).isoformat()

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
            )
            for v in vocab_states
        ],
        synced_at=now,
    )
