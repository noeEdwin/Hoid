from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.core.database import get_session
from app.models.flashcard import Deck, Flashcard, UserVocabularyState
from app.schemas.flashcard import (
    DeckCreate,
    DeckResponse,
    FlashcardCreate,
    FlashcardListResponse,
    FlashcardResponse,
    FlashcardUpdate,
)
from app.schemas.review import (
    ReviewQueueItem,
    ReviewQueueResponse,
    ReviewRating,
    ReviewResponse,
    ReviewSubmit,
)
from app.services.srs import (
    calculate_new_difficulty,
    calculate_new_ease,
    calculate_new_interval,
)

router = APIRouter(tags=["flashcards"])


@router.get("/decks", response_model=list[DeckResponse])
def list_decks(
    session: Session = Depends(get_session),
) -> list[DeckResponse]:
    decks = list(session.exec(select(Deck)).all())
    return [DeckResponse.model_validate(d) for d in decks]


@router.post("/decks", response_model=DeckResponse, status_code=201)
def create_deck(
    data: DeckCreate,
    session: Session = Depends(get_session),
) -> DeckResponse:
    deck = Deck(name=data.name, description=data.description)
    session.add(deck)
    session.commit()
    session.refresh(deck)
    return DeckResponse.model_validate(deck)


@router.delete("/decks/{deck_id}")
def delete_deck(
    deck_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, str]:
    deck = session.get(Deck, str(deck_id))
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    flashcards = list(
        session.exec(select(Flashcard).where(Flashcard.deck_id == str(deck_id))).all()
    )
    for fc in flashcards:
        state = session.exec(
            select(UserVocabularyState).where(UserVocabularyState.flashcard_id == fc.id)
        ).first()
        if state:
            session.delete(state)
        session.delete(fc)
    session.delete(deck)
    session.commit()
    return {"status": "deleted", "deck_id": str(deck_id)}


@router.get("/flashcards", response_model=FlashcardListResponse)
def list_flashcards(
    deck_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    session: Session = Depends(get_session),
) -> FlashcardListResponse:
    statement = select(Flashcard)
    if deck_id:
        statement = statement.where(Flashcard.deck_id == deck_id)
    if search:
        statement = statement.where(
            (Flashcard.sentence.contains(search))
            | (Flashcard.answer.contains(search))
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
        deck_id=data.deck_id,
        card_type=data.card_type,
        sentence=data.sentence,
        sentence_pinyin=data.sentence_pinyin,
        answer=data.answer,
        answer_pinyin=data.answer_pinyin,
        context=data.context,
        context_pinyin=data.context_pinyin,
        image_path=data.image_path,
        audio_path=data.audio_path,
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
    flashcard = session.get(Flashcard, str(flashcard_id))
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
    flashcard = session.get(Flashcard, str(flashcard_id))
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    state = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == str(flashcard_id)
        )
    ).first()
    if state:
        session.delete(state)
    session.delete(flashcard)
    session.commit()
    return {"status": "deleted", "flashcard_id": str(flashcard_id)}


@router.get("/decks/{deck_id}/review", response_model=ReviewQueueResponse)
def get_review_queue(
    deck_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> ReviewQueueResponse:
    statement = (
        select(UserVocabularyState, Flashcard)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .where(Flashcard.deck_id == str(deck_id))
        .order_by(col(UserVocabularyState.difficulty_score).desc())
        .limit(limit)
    )
    results = list(session.exec(statement).all())
    queue = [
        ReviewQueueItem(
            flashcard_id=state.flashcard_id,
            sentence=flashcard.sentence or "",
            sentence_pinyin=flashcard.sentence_pinyin or "",
            answer=flashcard.answer or "",
            answer_pinyin=flashcard.answer_pinyin or "",
            card_type=flashcard.card_type,
            srs_interval=state.srs_interval,
            ease_factor=state.ease_factor,
            difficulty_score=state.difficulty_score,
            total_reviews=state.total_reviews,
            total_failures=state.total_failures,
            consecutive_failures=state.consecutive_failures,
        )
        for state, flashcard in results
    ]
    return ReviewQueueResponse(queue=queue, total_pending=len(queue))


@router.post("/flashcards/{flashcard_id}/review", response_model=ReviewResponse)
def submit_review(
    flashcard_id: uuid.UUID,
    data: ReviewSubmit,
    session: Session = Depends(get_session),
) -> ReviewResponse:
    state = session.exec(
        select(UserVocabularyState).where(
            UserVocabularyState.flashcard_id == str(flashcard_id)
        )
    ).first()
    if not state:
        state = UserVocabularyState(flashcard_id=str(flashcard_id))
        session.add(state)
        session.flush()

    rating = ReviewRating.good if data.is_correct else ReviewRating.hard

    state.srs_interval = calculate_new_interval(
        state.srs_interval,
        state.ease_factor,
        state.difficulty_score,
        rating,
    )
    state.ease_factor = calculate_new_ease(state.ease_factor, rating)
    state.difficulty_score = calculate_new_difficulty(
        state.difficulty_score,
        rating,
        data.response_time_ms,
        state.consecutive_failures,
    )
    state.total_reviews += 1
    if not data.is_correct:
        state.total_failures += 1
        state.consecutive_failures += 1
    else:
        state.consecutive_failures = 0

    session.add(state)
    session.commit()
    session.refresh(state)

    return ReviewResponse(
        status="success",
        flashcard_id=str(flashcard_id),
        new_srs_interval=state.srs_interval,
        new_difficulty_score=state.difficulty_score,
    )
