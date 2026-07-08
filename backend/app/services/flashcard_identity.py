from __future__ import annotations

from typing import Protocol

from sqlmodel import Session, select

from app.models.flashcard import Flashcard


class FlashcardLike(Protocol):
    deck_id: str
    card_type: str
    sentence: str | None
    sentence_pinyin: str | None
    answer: str | None
    answer_pinyin: str | None
    context: str | None
    context_pinyin: str | None


def _normalize_text(value: str | None, lowercase: bool = False) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return normalized.lower() if lowercase else normalized


def flashcard_identity_tuple(
    *,
    deck_id: str,
    card_type: str,
    sentence: str | None,
    sentence_pinyin: str | None,
    answer: str | None,
    answer_pinyin: str | None,
    context: str | None,
    context_pinyin: str | None,
) -> tuple[str, str, str | None, str | None, str | None, str | None, str | None, str | None]:
    return (
        deck_id,
        _normalize_text(card_type) or "cloze_deletion",
        _normalize_text(sentence),
        _normalize_text(sentence_pinyin, lowercase=True),
        _normalize_text(answer),
        _normalize_text(answer_pinyin, lowercase=True),
        _normalize_text(context),
        _normalize_text(context_pinyin, lowercase=True),
    )


def flashcard_identity_from_record(item: FlashcardLike) -> tuple[str, str, str | None, str | None, str | None, str | None, str | None, str | None]:
    return flashcard_identity_tuple(
        deck_id=item.deck_id,
        card_type=item.card_type,
        sentence=item.sentence,
        sentence_pinyin=item.sentence_pinyin,
        answer=item.answer,
        answer_pinyin=item.answer_pinyin,
        context=item.context,
        context_pinyin=item.context_pinyin,
    )


def find_matching_flashcard(
    session: Session,
    *,
    deck_id: str,
    card_type: str,
    sentence: str | None,
    sentence_pinyin: str | None,
    answer: str | None,
    answer_pinyin: str | None,
    context: str | None,
    context_pinyin: str | None,
    exclude_id: str | None = None,
) -> Flashcard | None:
    target = flashcard_identity_tuple(
        deck_id=deck_id,
        card_type=card_type,
        sentence=sentence,
        sentence_pinyin=sentence_pinyin,
        answer=answer,
        answer_pinyin=answer_pinyin,
        context=context,
        context_pinyin=context_pinyin,
    )
    candidates = session.exec(
        select(Flashcard).where(
            Flashcard.deck_id == deck_id,
            Flashcard.card_type == (target[1] or "cloze_deletion"),
        )
    ).all()

    for candidate in candidates:
        if exclude_id and candidate.id == exclude_id:
            continue
        if flashcard_identity_from_record(candidate) == target:
            return candidate
    return None
