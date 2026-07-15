from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, col, select

from app.core.database import get_session
from app.models.flashcard import Flashcard, UserVocabularyState
from app.schemas.vocabulary import (
    DifficultToken,
    DifficultTokensResponse,
    VocabProfileItem,
    VocabProfileResponse,
)
from app.schemas.srs import SrsHealthCard, SrsHealthResponse
from app.core.config import settings

router = APIRouter(tags=["vocabulary"])


def _health_card(state: UserVocabularyState, flashcard: Flashcard) -> SrsHealthCard:
    return SrsHealthCard(
        flashcard_id=state.flashcard_id,
        answer=flashcard.answer or "",
        sentence=flashcard.sentence or "",
        difficulty_score=state.difficulty_score,
        total_reviews=state.total_reviews,
        total_failures=state.total_failures,
        srs_interval=state.srs_interval,
        last_reviewed_at=state.last_reviewed_at.isoformat() if state.last_reviewed_at else None,
        next_review_at=state.next_review_at.isoformat() if state.next_review_at else None,
    )


@router.get("/vocabulary/srs-health", response_model=SrsHealthResponse)
def get_srs_health(session: Session = Depends(get_session)) -> SrsHealthResponse:
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    local_now = now_utc.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(settings.SRS_TIMEZONE))
    local_today = local_now.date()
    today_start = datetime.combine(local_today, time.min, tzinfo=ZoneInfo(settings.SRS_TIMEZONE)).astimezone(timezone.utc).replace(tzinfo=None)
    today_end = datetime.combine(local_today, time.max, tzinfo=ZoneInfo(settings.SRS_TIMEZONE)).astimezone(timezone.utc).replace(tzinfo=None)
    tomorrow_end = datetime.combine(local_today + timedelta(days=1), time.max, tzinfo=ZoneInfo(settings.SRS_TIMEZONE)).astimezone(timezone.utc).replace(tzinfo=None)

    rows = list(session.exec(select(UserVocabularyState, Flashcard).join(
        Flashcard, UserVocabularyState.flashcard_id == Flashcard.id
    )).all())
    scheduled = [row for row in rows if row[0].next_review_at is not None]
    reviewed_unscheduled = [row for row in rows if row[0].total_reviews > 0 and row[0].next_review_at is None]
    new_cards = [row for row in rows if row[0].total_reviews == 0]
    due_today = [row for row in rows if row[0].next_review_at is None or row[0].next_review_at <= today_end]
    due_tomorrow = [row for row in rows if row[0].next_review_at is not None and today_end < row[0].next_review_at <= tomorrow_end]
    hardest_due = sorted(due_today, key=lambda row: row[0].difficulty_score, reverse=True)[:10]
    recently_reviewed = sorted(
        [row for row in rows if row[0].last_reviewed_at is not None],
        key=lambda row: row[0].last_reviewed_at or datetime.min,
        reverse=True,
    )[:10]
    return SrsHealthResponse(
        timezone=settings.SRS_TIMEZONE,
        now=local_now.isoformat(),
        scheduled_cards=len(scheduled),
        unscheduled_reviewed_cards=len(reviewed_unscheduled),
        new_cards=len(new_cards),
        due_today=len(due_today),
        due_tomorrow=len(due_tomorrow),
        hardest_due=[_health_card(*row) for row in hardest_due],
        recently_reviewed=[_health_card(*row) for row in recently_reviewed],
    )


@router.get("/vocabulary/difficulty", response_model=DifficultTokensResponse)
def get_difficult_tokens(
    n: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session),
) -> DifficultTokensResponse:
    statement = (
        select(UserVocabularyState, Flashcard)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .order_by(col(UserVocabularyState.difficulty_score).desc())
        .limit(n)
    )
    results = list(session.exec(statement).all())
    tokens = [
        DifficultToken(
            flashcard_id=state.flashcard_id,
            sentence=flashcard.sentence or "",
            answer=flashcard.answer or "",
            answer_pinyin=flashcard.answer_pinyin or "",
            card_type=flashcard.card_type,
            difficulty_score=state.difficulty_score,
            total_reviews=state.total_reviews,
            total_failures=state.total_failures,
        )
        for state, flashcard in results
    ]
    return DifficultTokensResponse(difficult_tokens=tokens)


@router.get("/vocabulary/profile", response_model=VocabProfileResponse)
def get_vocabulary_profile(
    threshold: float = Query(0.5, ge=0.0, le=1.0),
    session: Session = Depends(get_session),
) -> VocabProfileResponse:
    statement = (
        select(UserVocabularyState, Flashcard)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .where(UserVocabularyState.difficulty_score <= threshold)
        .order_by(col(UserVocabularyState.difficulty_score).asc())
    )
    results = list(session.exec(statement).all())
    known_words = [
        VocabProfileItem(
            flashcard_id=state.flashcard_id,
            sentence=flashcard.sentence or "",
            answer=flashcard.answer or "",
            answer_pinyin=flashcard.answer_pinyin or "",
            difficulty_score=state.difficulty_score,
        )
        for state, flashcard in results
    ]
    total_cards = len(session.exec(select(Flashcard)).all())
    return VocabProfileResponse(
        known_words=known_words,
        total_known=len(known_words),
        total_cards=total_cards,
    )
