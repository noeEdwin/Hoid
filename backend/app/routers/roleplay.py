from __future__ import annotations

import base64
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlmodel import Session, col, select

from app.core.database import get_session
from app.models.flashcard import Flashcard, UserVocabularyState
from app.models.roleplay import ChatLog, RoleplaySession, TurnEvaluation
from app.models.scenario import Scenario
from app.schemas.roleplay import (
    ErrorEvent,
    GrammarEvaluation,
    HintResponseEvent,
    InitialGreeting,
    RequestHintEvent,
    RoleplayEndRequest,
    RoleplayEndResponse,
    RoleplayStartRequest,
    RoleplayStartResponse,
    ScenarioListResponse,
    ScenarioResponse,
    SessionSummary,
    TarsResponseEvent,
    UserSpeechEvent,
)
from app.services.llm import generate_greeting, generate_response
from app.services.session_store import (
    SessionState,
    create_session,
    delete_session,
    get_session_state,
)
from app.services.stt import transcribe_audio
from app.services.tts import synthesize_speech

logger = logging.getLogger(__name__)

router = APIRouter(tags=["roleplay"])


@router.get("/roleplay/scenarios", response_model=ScenarioListResponse)
def list_scenarios(
    difficulty: str | None = Query(None),
    session: Session = Depends(get_session),
) -> ScenarioListResponse:
    statement = select(Scenario)
    if difficulty:
        statement = statement.where(Scenario.difficulty == difficulty)
    scenarios = list(session.exec(statement).all())
    return ScenarioListResponse(
        scenarios=[
            ScenarioResponse(
                id=s.id,
                title=s.title,
                description=s.description,
                difficulty=s.difficulty,
                target_grammar=json.loads(s.target_grammar),
                example_prompt=s.example_prompt,
            )
            for s in scenarios
        ]
    )


@router.post("/roleplay/start", response_model=RoleplayStartResponse)
async def start_roleplay(
    req: RoleplayStartRequest,
    db: Session = Depends(get_session),
) -> RoleplayStartResponse:
    scenario = db.get(Scenario, req.scenario_id)
    if scenario is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scenario not found")

    target_grammar = json.loads(scenario.target_grammar)

    statement = (
        select(UserVocabularyState, Flashcard)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .order_by(col(UserVocabularyState.difficulty_score).desc())
        .limit(5)
    )
    difficult = list(db.exec(statement).all())
    forced_tokens = [flashcard.answer for _, flashcard in difficult if flashcard.answer]
    if not forced_tokens:
        forced_tokens = target_grammar[:3]

    profile_stmt = (
        select(UserVocabularyState, Flashcard)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .where(UserVocabularyState.difficulty_score <= 0.5)
    )
    known = list(db.exec(profile_stmt).all())
    known_vocab = [flashcard.answer for _, flashcard in known if flashcard.answer]
    if not known_vocab:
        known_vocab = ["你好", "谢谢", "请", "我", "你", "是", "好", "不"]

    roleplay_session = RoleplaySession(scenario_id=scenario.id)
    db.add(roleplay_session)
    db.commit()
    db.refresh(roleplay_session)

    state = create_session(
        session_id=roleplay_session.id,
        scenario_id=scenario.id,
        scenario_title=scenario.title,
        scenario_description=scenario.description,
        forced_tokens=forced_tokens,
        known_vocab=known_vocab,
    )

    greeting_text, greeting_pinyin = await generate_greeting(
        scenario_title=scenario.title,
        scenario_description=scenario.description,
        forced_tokens=forced_tokens,
        known_vocab=known_vocab,
    )

    greeting_audio = await synthesize_speech(greeting_text)
    audio_b64 = base64.b64encode(greeting_audio).decode()

    state.messages.append({"role": "assistant", "content": greeting_text})

    greeting_log = ChatLog(
        session_id=roleplay_session.id,
        sender="tars",
        text_content=greeting_text,
    )
    db.add(greeting_log)
    db.commit()

    return RoleplayStartResponse(
        session_id=roleplay_session.id,
        websocket_url=f"ws://localhost:8000/api/roleplay/stream/{roleplay_session.id}",
        scenario=ScenarioResponse(
            id=scenario.id,
            title=scenario.title,
            description=scenario.description,
            difficulty=scenario.difficulty,
            target_grammar=target_grammar,
            example_prompt=scenario.example_prompt,
        ),
        forced_tokens=forced_tokens,
        initial_greeting=InitialGreeting(
            text=greeting_text,
            pinyin=greeting_pinyin,
            audio_b64=audio_b64,
        ),
    )


@router.websocket("/roleplay/stream/{session_id}")
async def stream_roleplay(
    websocket: WebSocket,
    session_id: uuid.UUID,
) -> None:
    await websocket.accept()

    state = get_session_state(session_id)
    if state is None:
        await websocket.send_json(
            ErrorEvent(
                message="Session not found",
                recoverable=False,
            ).model_dump()
        )
        await websocket.close()
        return

    db = next(get_session())

    try:
        while True:
            raw = await websocket.receive_json()
            event_type = raw.get("event_type", "")

            if event_type == "user_speech":
                await _handle_user_speech(websocket, state, raw, db)
            elif event_type == "request_hint":
                await _handle_hint(websocket, state)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as e:
        logger.error("WebSocket error for session %s: %s", session_id, e)
        try:
            await websocket.send_json(
                ErrorEvent(
                    message=str(e),
                    recoverable=True,
                ).model_dump()
            )
        except Exception:
            pass
    finally:
        db.close()


async def _handle_user_speech(
    websocket: WebSocket,
    state: SessionState,
    raw: dict,
    db: Session,
) -> None:
    try:
        event = UserSpeechEvent(**raw)
    except Exception:
        await websocket.send_json(
            ErrorEvent(message="Invalid user_speech payload", recoverable=True).model_dump()
        )
        return

    audio_bytes = base64.b64decode(event.audio_chunk_b64)
    user_text = await transcribe_audio(audio_bytes)

    state.messages.append({"role": "user", "content": user_text})

    user_log = ChatLog(
        session_id=state.session_id,
        sender="user",
        text_content=user_text,
    )
    db.add(user_log)
    db.commit()

    ai_text, ai_pinyin = await generate_response(
        messages=state.messages,
        scenario_description=state.scenario_description,
        current_target=state.current_target,
        failure_count=state.failure_count,
        failure_threshold=state.failure_threshold,
        known_vocab=state.known_vocab,
        remaining_targets=state.remaining_targets,
    )

    state.messages.append({"role": "assistant", "content": ai_text})
    state.turn_count += 1

    ai_log = ChatLog(
        session_id=state.session_id,
        sender="tars",
        text_content=ai_text,
    )
    db.add(ai_log)
    db.commit()

    target_used = state.current_target in user_text
    grammar_evals = []
    if state.current_target:
        passed = target_used
        grammar_evals.append(
            GrammarEvaluation(
                target_token=state.current_target,
                passed=passed,
                feedback_explanation=None if passed else f"你没有使用\u201c{state.current_target}\u201d。",
            )
        )
        if passed:
            if state.current_target not in state.user_passed_tokens:
                state.user_passed_tokens.append(state.current_target)
            state.failure_count = 0
            if state.remaining_targets:
                state.current_target = state.remaining_targets.pop(0)
        else:
            state.failure_count += 1
            if state.current_target not in state.user_failed_tokens:
                state.user_failed_tokens.append(state.current_target)
            if state.failure_count >= state.failure_threshold and state.remaining_targets:
                state.current_target = state.remaining_targets.pop(0)
                state.failure_count = 0

    tts_audio = await synthesize_speech(ai_text)
    audio_b64 = base64.b64encode(tts_audio).decode()

    response_event = TarsResponseEvent(
        transcribed_user_text=user_text,
        grammar_evaluations=grammar_evals,
        ai_text_reply=ai_text,
        ai_pinyin=ai_pinyin,
        ai_audio_b64=audio_b64,
    )
    await websocket.send_json(response_event.model_dump())


async def _handle_hint(
    websocket: WebSocket,
    state: SessionState,
) -> None:
    target = state.current_target
    hint = HintResponseEvent(
        hint_text=f"试试使用\u201c{target}\u201d来造句。",
        suggested_structure=f"{target} + ...",
    )
    await websocket.send_json(hint.model_dump())


@router.post("/roleplay/end", response_model=RoleplayEndResponse)
async def end_roleplay(
    req: RoleplayEndRequest,
    db: Session = Depends(get_session),
) -> RoleplayEndResponse:
    state = delete_session(req.session_id)
    if state is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    session_row = db.get(RoleplaySession, req.session_id)
    if session_row:
        session_row.ended_at = datetime.now(timezone.utc)
        db.add(session_row)
        db.commit()

    summary = SessionSummary(
        total_turns=state.turn_count,
        tokens_forced=state.forced_tokens,
        tokens_passed=state.user_passed_tokens,
        tokens_failed=state.user_failed_tokens,
    )

    return RoleplayEndResponse(
        status="success",
        message=f"Session closed. {state.turn_count} turns logged.",
        session_summary=summary,
    )
