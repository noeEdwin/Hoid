from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import pypinyin
from sqlalchemy import or_
from sqlmodel import Session, col, select

from app.models.flashcard import Flashcard, UserVocabularyState
from app.models.roleplay import (
    RoleplaySession,
    RoleplaySessionTarget,
    RoleplayVocabularyState,
)
from app.models.scenario import Scenario
from app.services.scenarios import scenario_targets

MAX_TARGETS = 3
CANDIDATE_POOL_SIZE = 15


@dataclass(frozen=True)
class FocusTarget:
    flashcard_id: str | None
    word: str
    pinyin: str | None
    sentence: str | None
    context: str | None
    source: str
    srs_difficulty: float = 0.0
    roleplay_difficulty: float = 0.5


SemanticSelector = Callable[[Scenario, Sequence[FocusTarget]], Awaitable[Sequence[str]]]


def _scenario_words(scenario: Scenario) -> list[str]:
    return scenario_targets(scenario)


def _is_exactly_relevant(target: FocusTarget, scenario: Scenario) -> bool:
    scenario_targets = _scenario_words(scenario)
    scenario_text = f"{scenario.title}\n{scenario.description}\n{' '.join(scenario_targets)}"
    card_text = f"{target.word}\n{target.sentence or ''}\n{target.context or ''}"
    return target.word in scenario_text or any(word in card_text for word in scenario_targets)


def exactly_relevant_candidates(
    candidates: Sequence[FocusTarget],
    scenario: Scenario,
) -> list[FocusTarget]:
    return [target for target in candidates if _is_exactly_relevant(target, scenario)]


def _candidate_priority(
    srs_difficulty: float,
    roleplay_state: RoleplayVocabularyState | None,
    now: datetime,
) -> float:
    production = roleplay_state.production_difficulty if roleplay_state else 0.5
    score = 0.65 * srs_difficulty + 0.35 * production
    if (
        roleplay_state
        and roleplay_state.last_practiced_at
        and roleplay_state.consecutive_failures == 0
        and roleplay_state.last_practiced_at >= now - timedelta(days=7)
    ):
        score *= 0.5
    return score


def eligible_candidates(
    db: Session,
    requested_flashcard_ids: Sequence[str] | None = None,
    now: datetime | None = None,
) -> list[FocusTarget]:
    statement = (
        select(Flashcard, UserVocabularyState, RoleplayVocabularyState)
        .join(UserVocabularyState, UserVocabularyState.flashcard_id == Flashcard.id)
        .join(
            RoleplayVocabularyState,
            RoleplayVocabularyState.flashcard_id == Flashcard.id,
            isouter=True,
        )
        .where(UserVocabularyState.total_reviews > 0)
        .where(
            or_(
                UserVocabularyState.difficulty_score >= 0.5,
                UserVocabularyState.consecutive_failures > 0,
            )
        )
    )
    if requested_flashcard_ids is not None:
        unique_ids = list(dict.fromkeys(requested_flashcard_ids))
        statement = statement.where(col(Flashcard.id).in_(unique_ids))

    current_time = now or datetime.now(timezone.utc).replace(tzinfo=None)
    ranked: list[tuple[float, FocusTarget]] = []
    for flashcard, srs_state, roleplay_state in db.exec(statement).all():
        if not flashcard.answer:
            continue
        production = roleplay_state.production_difficulty if roleplay_state else 0.5
        target = FocusTarget(
            flashcard_id=flashcard.id,
            word=flashcard.answer,
            pinyin=flashcard.answer_pinyin,
            sentence=flashcard.sentence,
            context=flashcard.context,
            source="flashcard",
            srs_difficulty=srs_state.difficulty_score,
            roleplay_difficulty=production,
        )
        ranked.append(
            (_candidate_priority(srs_state.difficulty_score, roleplay_state, current_time), target)
        )
    ranked.sort(key=lambda item: (-item[0], item[1].flashcard_id or ""))
    return [target for _, target in ranked[:CANDIDATE_POOL_SIZE]]


async def select_targets(
    db: Session,
    scenario: Scenario,
    requested_flashcard_ids: Sequence[str] | None = None,
    scenario_target_words: Sequence[str] | None = None,
    semantic_selector: SemanticSelector | None = None,
) -> list[FocusTarget]:
    if requested_flashcard_ids is not None:
        requested_ids = list(dict.fromkeys(requested_flashcard_ids))
        candidates = eligible_candidates(db, requested_ids)
        candidates_by_id = {candidate.flashcard_id: candidate for candidate in candidates}
        eligible_ids = set(candidates_by_id)
        if any(flashcard_id not in eligible_ids for flashcard_id in requested_ids):
            raise ValueError("One or more target flashcards are not eligible")
        selected = [candidates_by_id[flashcard_id] for flashcard_id in requested_ids][
            :MAX_TARGETS
        ]
    else:
        candidates = eligible_candidates(db)
        selected = [target for target in candidates if _is_exactly_relevant(target, scenario)]
        selected = selected[:MAX_TARGETS]

    if len(selected) < MAX_TARGETS and semantic_selector:
        remaining = [target for target in candidates if target not in selected]
        selected_ids = await semantic_selector(scenario, remaining)
        valid_by_id = {target.flashcard_id: target for target in remaining}
        for flashcard_id in dict.fromkeys(selected_ids):
            target = valid_by_id.get(flashcard_id)
            if target and target not in selected:
                selected.append(target)
            if len(selected) == MAX_TARGETS:
                break

    allowed_scenario_words = _scenario_words(scenario)
    requested_words = list(dict.fromkeys(scenario_target_words or []))
    if any(word not in allowed_scenario_words for word in requested_words):
        raise ValueError("One or more scenario target words are invalid")
    fill_words = requested_words + allowed_scenario_words
    selected_words = {target.word for target in selected}
    for word in fill_words:
        if len(selected) == MAX_TARGETS:
            break
        if word in selected_words:
            continue
        selected.append(
            FocusTarget(
                flashcard_id=None,
                word=word,
                pinyin=" ".join(
                    pypinyin.lazy_pinyin(word, style=pypinyin.Style.TONE)
                ),
                sentence=None,
                context=None,
                source="scenario",
            )
        )
        selected_words.add(word)
    return selected


def persist_session_targets(
    db: Session,
    session_id: uuid.UUID,
    targets: Sequence[FocusTarget],
) -> list[RoleplaySessionTarget]:
    rows = [
        RoleplaySessionTarget(
            session_id=session_id,
            flashcard_id=target.flashcard_id,
            target_text=target.word,
            target_pinyin=target.pinyin,
            source=target.source,
            sequence=sequence,
            selected_srs_difficulty=target.srs_difficulty,
            selected_roleplay_difficulty=target.roleplay_difficulty,
        )
        for sequence, target in enumerate(targets)
    ]
    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def record_attempt(db: Session, target_id: uuid.UUID, passed: bool) -> None:
    target = db.get(RoleplaySessionTarget, target_id)
    if target is None or target.status != "pending":
        return
    target.attempts += 1
    if passed:
        target.status = "passed"
        target.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    elif target.attempts >= 3:
        target.status = "failed"
        target.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(target)
    db.commit()


def record_hint(db: Session, target_id: uuid.UUID) -> None:
    target = db.get(RoleplaySessionTarget, target_id)
    if target is None or target.status != "pending":
        return
    target.hints_used += 1
    db.add(target)
    db.commit()


def finalize_targets(db: Session, session_id: uuid.UUID) -> list[RoleplaySessionTarget]:
    rows = list(
        db.exec(
            select(RoleplaySessionTarget)
            .where(RoleplaySessionTarget.session_id == session_id)
            .order_by(RoleplaySessionTarget.sequence)
        ).all()
    )
    session = db.get(RoleplaySession, session_id)
    if session is not None and session.ended_at is not None:
        return rows
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for target in rows:
        if target.status == "pending":
            target.status = "failed" if target.attempts else "unattempted"
            target.completed_at = now
        if not target.flashcard_id or not target.attempts:
            db.add(target)
            continue
        state = db.get(RoleplayVocabularyState, target.flashcard_id)
        if state is None:
            state = RoleplayVocabularyState(flashcard_id=target.flashcard_id)
        state.total_sessions += 1
        state.total_attempts += target.attempts
        if target.status == "passed":
            delta = -0.15 if target.attempts == 1 and target.hints_used == 0 else -0.07
            state.successful_sessions += 1
            state.consecutive_failures = 0
        else:
            delta = 0.15
            state.failed_sessions += 1
            state.consecutive_failures += 1
        state.production_difficulty = min(1.0, max(0.0, state.production_difficulty + delta))
        state.last_practiced_at = now
        state.updated_at = now
        db.add(target)
        db.add(state)
    if session is not None:
        session.ended_at = now
        db.add(session)
    db.commit()
    return rows
