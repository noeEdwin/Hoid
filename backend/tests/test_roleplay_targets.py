from __future__ import annotations

import base64
import json
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlmodel import Session, select

from app.models.flashcard import Deck, Flashcard, UserVocabularyState
from app.models.roleplay import (
    RoleplaySession,
    RoleplaySessionTarget,
    RoleplayVocabularyState,
)
from app.models.scenario import Scenario
from app.services.roleplay_targets import (
    FocusTarget,
    eligible_candidates,
    finalize_targets,
    persist_session_targets,
    record_attempt,
    record_hint,
    select_targets,
)


def _scenario(db: Session, grammar: list[str] | None = None) -> Scenario:
    scenario = Scenario(
        title="在餐馆点菜",
        description="顾客看菜单并点菜",
        difficulty="beginner",
        target_grammar=json.dumps(grammar or ["菜单", "请", "要"]),
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


def _card_with_state(
    db: Session,
    answer: str,
    *,
    difficulty: float = 0.8,
    total_reviews: int = 2,
    consecutive_failures: int = 0,
    sentence: str | None = None,
    context: str | None = None,
) -> tuple[Flashcard, UserVocabularyState]:
    deck = Deck(name=f"Deck {answer}")
    db.add(deck)
    db.flush()
    card = Flashcard(
        deck_id=deck.id,
        answer=answer,
        answer_pinyin=f"{answer}-pinyin",
        sentence=sentence or f"我想看___（{answer}）",
        context=context,
    )
    db.add(card)
    db.flush()
    state = UserVocabularyState(
        flashcard_id=card.id,
        srs_interval=12,
        ease_factor=2.1,
        total_reviews=total_reviews,
        total_failures=4,
        consecutive_failures=consecutive_failures,
        consecutive_correct=2,
        difficulty_score=difficulty,
    )
    db.add(state)
    db.commit()
    db.refresh(card)
    db.refresh(state)
    return card, state


def test_eligibility_requires_review_and_difficulty_or_failure(db_session: Session) -> None:
    eligible, _ = _card_with_state(db_session, "菜单")
    _card_with_state(db_session, "未学", total_reviews=0, difficulty=1.0)
    recovered, _ = _card_with_state(db_session, "简单", difficulty=0.2)
    failing, _ = _card_with_state(
        db_session, "再试", difficulty=0.2, consecutive_failures=1
    )

    candidates = eligible_candidates(db_session)

    assert {candidate.flashcard_id for candidate in candidates} == {
        eligible.id,
        failing.id,
    }
    assert recovered.id not in {candidate.flashcard_id for candidate in candidates}


@pytest.mark.asyncio
async def test_selection_is_relevant_and_limited_to_three(db_session: Session) -> None:
    scenario = _scenario(db_session, ["菜单"])
    for index in range(5):
        _card_with_state(
            db_session,
            f"词{index}",
            difficulty=0.9 - index * 0.05,
            context="菜单上的内容",
        )

    selected = await select_targets(db_session, scenario)

    assert len(selected) == 3
    assert all(target.source == "flashcard" for target in selected)


@pytest.mark.asyncio
async def test_selection_validates_semantic_ids_and_fills_scenario_targets(
    db_session: Session,
) -> None:
    scenario = _scenario(db_session, ["菜单", "请", "要"])
    semantic_card, _ = _card_with_state(
        db_session, "结账", sentence="这个词与场景没有精确匹配"
    )

    async def semantic_selector(
        selected_scenario: Scenario,
        candidates: list[FocusTarget],
    ) -> list[str]:
        assert selected_scenario.id == scenario.id
        assert candidates[0].flashcard_id == semantic_card.id
        return ["not-a-candidate", semantic_card.id, semantic_card.id]

    selected = await select_targets(
        db_session, scenario, semantic_selector=semantic_selector
    )

    assert [(target.word, target.source) for target in selected] == [
        ("结账", "flashcard"),
        ("菜单", "scenario"),
        ("请", "scenario"),
    ]


@pytest.mark.asyncio
async def test_requested_flashcard_ids_must_be_eligible(db_session: Session) -> None:
    scenario = _scenario(db_session)
    ineligible, _ = _card_with_state(
        db_session, "没复习", total_reviews=0, difficulty=1.0
    )

    with pytest.raises(ValueError, match="not eligible"):
        await select_targets(
            db_session,
            scenario,
            requested_flashcard_ids=[ineligible.id],
        )


@pytest.mark.asyncio
async def test_requested_flashcard_order_is_preserved(db_session: Session) -> None:
    scenario = _scenario(db_session)
    first, _ = _card_with_state(db_session, "第一", difficulty=0.7)
    second, _ = _card_with_state(db_session, "第二", difficulty=0.95)

    selected = await select_targets(
        db_session,
        scenario,
        requested_flashcard_ids=[first.id, second.id],
    )

    assert [target.flashcard_id for target in selected[:2]] == [first.id, second.id]


def test_targets_endpoint_uses_validated_semantic_selection(
    client,
    db_session: Session,
) -> None:
    scenario = _scenario(db_session, ["菜单", "请"])
    card, _ = _card_with_state(
        db_session,
        "结账",
        sentence="这个困难词没有精确场景关键词",
        context="付款以后离开",
    )

    with patch(
        "app.routers.roleplay.select_relevant_flashcard_ids",
        new=AsyncMock(return_value=[card.id, "invented-id"]),
    ):
        response = client.post(
            "/api/roleplay/targets",
            json={"scenario_id": str(scenario.id)},
        )

    assert response.status_code == 200
    focus_words = response.json()["focus_words"]
    assert focus_words[0]["flashcard_id"] == card.id
    assert focus_words[0]["source"] == "flashcard"
    assert len(focus_words) == 3


def test_targets_endpoint_returns_structured_focus_words(client, db_session: Session) -> None:
    scenario = _scenario(db_session)
    card, _ = _card_with_state(db_session, "菜单")

    response = client.post(
        "/api/roleplay/targets", json={"scenario_id": str(scenario.id)}
    )

    assert response.status_code == 200
    focus_words = response.json()["focus_words"]
    assert len(focus_words) <= 3
    assert focus_words[0] == {
        "flashcard_id": card.id,
        "word": "菜单",
        "pinyin": "菜单-pinyin",
        "sentence": "我想看___（菜单）",
        "source": "flashcard",
    }


def test_persistence_and_roleplay_only_production_updates(db_session: Session) -> None:
    scenario = _scenario(db_session)
    card, _ = _card_with_state(db_session, "菜单")
    session = RoleplaySession(scenario_id=scenario.id)
    db_session.add(session)
    db_session.commit()
    target = FocusTarget(
        flashcard_id=card.id,
        word="菜单",
        pinyin="cài dān",
        sentence=card.sentence,
        context=card.context,
        source="flashcard",
        srs_difficulty=0.8,
    )
    row = persist_session_targets(db_session, session.id, [target])[0]

    record_hint(db_session, row.id)
    record_attempt(db_session, row.id, passed=False)
    record_attempt(db_session, row.id, passed=True)
    outcomes = finalize_targets(db_session, session.id)

    roleplay_state = db_session.get(RoleplayVocabularyState, card.id)
    assert outcomes[0].status == "passed"
    assert outcomes[0].attempts == 2
    assert outcomes[0].hints_used == 1
    assert roleplay_state is not None
    assert roleplay_state.production_difficulty == pytest.approx(0.43)
    assert roleplay_state.total_sessions == 1
    assert roleplay_state.total_attempts == 2
    assert roleplay_state.successful_sessions == 1

    finalize_targets(db_session, session.id)
    db_session.refresh(roleplay_state)
    assert roleplay_state.total_sessions == 1


def test_turns_and_end_leave_srs_snapshot_unchanged(
    client,
    db_session: Session,
) -> None:
    scenario = _scenario(db_session)
    card, state = _card_with_state(
        db_session,
        "菜单",
        difficulty=0.91,
        consecutive_failures=2,
    )
    before = state.model_dump()

    with (
        patch(
            "app.routers.roleplay.generate_greeting",
            new=AsyncMock(return_value=("您好，请看菜单。", "nín hǎo")),
        ),
        patch(
            "app.routers.roleplay.generate_response",
            new=AsyncMock(return_value=("好的。", "hǎo de")),
        ),
        patch(
            "app.routers.roleplay.transcribe_audio",
            new=AsyncMock(return_value="我想看菜单"),
        ),
        patch(
            "app.routers.roleplay.synthesize_speech",
            new=AsyncMock(return_value=b"mp3"),
        ),
    ):
        start = client.post(
            "/api/roleplay/start",
            json={
                "scenario_id": str(scenario.id),
                "target_flashcard_ids": [card.id],
            },
        )
        assert start.status_code == 200
        session_id = start.json()["session_id"]
        with client.websocket_connect(f"/api/roleplay/stream/{session_id}") as websocket:
            websocket.send_json(
                {
                    "event_type": "user_speech",
                    "audio_chunk_b64": base64.b64encode(b"audio").decode(),
                    "audio_mime_type": "audio/mp4",
                }
            )
            assert websocket.receive_json()["grammar_evaluations"][0]["passed"] is True

        ended = client.post("/api/roleplay/end", json={"session_id": session_id})

    assert ended.status_code == 200
    assert ended.json()["session_summary"]["targets"][0]["status"] == "passed"
    persisted_target = db_session.exec(
        select(RoleplaySessionTarget).where(
            RoleplaySessionTarget.session_id == uuid.UUID(session_id)
        )
    ).first()
    assert persisted_target is not None
    assert persisted_target.attempts == 1
    db_session.refresh(state)
    assert state.model_dump() == before
