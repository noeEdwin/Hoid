from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.core.database import get_session
from app.models.flashcard import Flashcard, UserVocabularyState
from app.schemas.flashcard import (
    FlashcardCreate,
    FlashcardListResponse,
    FlashcardResponse,
    FlashcardUpdate,
)
from app.schemas.review import (
    ReviewQueueItem,
    ReviewQueueResponse,
    ReviewResponse,
    ReviewSubmit,
)
from app.services.srs import (
    calculate_new_difficulty,
    calculate_new_ease,
    calculate_new_interval,
)

router = APIRouter(tags=["flashcards"])


@router.get("/flashcards", response_model=FlashcardListResponse)
def list_flashcards(
    grammar_type: str | None = Query(None),
    search: str | None = Query(None),
    session: Session = Depends(get_session),
) -> FlashcardListResponse:
    statement = select(Flashcard)
    if grammar_type:
        statement = statement.where(Flashcard.grammar_type == grammar_type)
    if search:
        statement = statement.where(
            (Flashcard.character.contains(search))
            | (Flashcard.meaning.contains(search))
        )
    flashcards = list(session.exec(statement).all())
    return FlashcardListResponse(
        flashcards=[FlashcardResponse.model_validate(f) for f in flashcards],
        total=len(flashcards),
    )


@router.post("/flashcards", response_model=FlashcardResponse, status_code=201)
def create_flashcard(
    data: FlashcardCreate,
    session: Session = Depends(get_session),
) -> FlashcardResponse:
    flashcard = Flashcard(
        character=data.character,
        pinyin=data.pinyin,
        meaning=data.meaning,
        grammar_type=data.grammar_type,
    )
    session.add(flashcard)
    session.commit()
    session.refresh(flashcard)
    return FlashcardResponse.model_validate(flashcard)


@router.put("/flashcards/{flashcard_id}", response_model=FlashcardResponse)
def update_flashcard(
    flashcard_id: uuid.UUID,
    data: FlashcardUpdate,
    session: Session = Depends(get_session),
) -> FlashcardResponse:
    flashcard = session.get(Flashcard, flashcard_id)
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(flashcard, field, value)
    session.add(flashcard)
    session.commit()
    session.refresh(flashcard)
    return FlashcardResponse.model_validate(flashcard)


@router.delete("/flashcards/{flashcard_id}")
def delete_flashcard(
    flashcard_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, str]:
    flashcard = session.get(Flashcard, flashcard_id)
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    state = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == flashcard_id
        )
    ).first()
    if state:
        session.delete(state)
    session.delete(flashcard)
    session.commit()
    return {"status": "deleted", "flashcard_id": str(flashcard_id)}


@router.get("/flashcards/review", response_model=ReviewQueueResponse)
def get_review_queue(
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> ReviewQueueResponse:
    statement = (
        select(UserVocabularyState, Flashcard)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .order_by(col(UserVocabularyState.difficulty_score).desc())
        .limit(limit)
    )
    results = list(session.exec(statement).all())
    queue = [
        ReviewQueueItem(
            flashcard_id=state.flashcard_id,
            character=flashcard.character,
            pinyin=flashcard.pinyin,
            meaning=flashcard.meaning,
            grammar_type=flashcard.grammar_type,
            srs_interval=state.srs_interval,
            ease_factor=state.ease_factor,
            difficulty_score=state.difficulty_score,
            total_reviews=state.total_reviews,
            total_failures=state.total_failures,
        )
        for state, flashcard in results
    ]
    return ReviewQueueResponse(queue=queue, total_pending=len(queue))


@router.post("/flashcards/review/submit", response_model=ReviewResponse)
def submit_review(
    data: ReviewSubmit,
    session: Session = Depends(get_session),
) -> ReviewResponse:
    state = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == data.flashcard_id
        )
    ).first()
    if not state:
        state = UserVocabularyState(flashcard_id=data.flashcard_id)
        session.add(state)
        session.flush()

    state.srs_interval = calculate_new_interval(
        state.srs_interval,
        state.ease_factor,
        state.difficulty_score,
        data.review_rating,
    )
    state.ease_factor = calculate_new_ease(state.ease_factor, data.review_rating)
    state.difficulty_score = calculate_new_difficulty(
        state.difficulty_score,
        data.review_rating,
        data.response_time_ms,
        state.consecutive_failures,
    )
    state.total_reviews += 1
    if data.review_rating.value == "hard":
        state.total_failures += 1
        state.consecutive_failures += 1
    else:
        state.consecutive_failures = 0

    session.add(state)
    session.commit()
    session.refresh(state)

    return ReviewResponse(
        status="success",
        flashcard_id=data.flashcard_id,
        new_srs_interval=state.srs_interval,
        new_difficulty_score=state.difficulty_score,
    )
