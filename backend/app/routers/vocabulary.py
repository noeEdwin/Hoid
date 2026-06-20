from __future__ import annotations

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

router = APIRouter(tags=["vocabulary"])


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
