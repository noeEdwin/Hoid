from __future__ import annotations

import base64
import binascii
import logging
import uuid
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import ValidationError
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.flashcard import Flashcard, UserVocabularyState
from app.models.roleplay import (
    ChatLog,
    RoleplaySession,
    TurnEvaluation,
)
from app.models.scenario import Scenario
from app.schemas.roleplay import (
    CardDraftRequest,
    CardDraftResponse,
    ErrorEvent,
    ExistingCardRecommendation,
    FocusWord,
    GrammarEvaluation,
    HintResponseEvent,
    InitialGreeting,
    RequestHintEvent,
    RoleplayEndRequest,
    RoleplayEndResponse,
    RoleplayStartRequest,
    RoleplayStartResponse,
    RoleplayTargetsRequest,
    RoleplayTargetsResponse,
    ScenarioArchiveResponse,
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioRecommendationsRequest,
    ScenarioRecommendationsResponse,
    ScenarioResponse,
    ScenarioUpdate,
    SuggestedNewTarget,
    SessionSummary,
    TargetOutcome,
    TarsResponseEvent,
    UserSpeechEvent,
)
from app.services.llm import (
    generate_card_draft,
    generate_greeting,
    generate_new_target_suggestions,
    generate_response,
    select_relevant_flashcard_ids,
)
from app.services.roleplay_targets import (
    eligible_candidates,
    exactly_relevant_candidates,
    finalize_targets,
    persist_session_targets,
    record_attempt,
    record_hint,
    select_targets,
)
from app.services.scenarios import (
    active_scenario,
    apply_payload,
    encode_targets,
    has_active_title,
    scenario_response,
)
from app.services.session_store import (
    SessionState,
    SessionTarget,
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
    difficulty: str | None = Query(None, pattern="^(beginner|intermediate|advanced)$"),
    session: Session = Depends(get_session),
) -> ScenarioListResponse:
    statement = select(Scenario).where(Scenario.archived_at.is_(None))
    if difficulty:
        statement = statement.where(Scenario.difficulty == difficulty)
    scenarios = list(session.exec(statement).all())
    return ScenarioListResponse(scenarios=[scenario_response(item) for item in scenarios])


@router.post(
    "/roleplay/scenarios/recommendations",
    response_model=ScenarioRecommendationsResponse,
)
async def recommend_scenario_targets(
    req: ScenarioRecommendationsRequest,
    db: Session = Depends(get_session),
) -> ScenarioRecommendationsResponse:
    candidates = eligible_candidates(db)
    unsaved_scenario = Scenario(
        title=req.title,
        description=req.description,
        difficulty=req.difficulty,
        target_grammar=encode_targets(req.selected_targets),
    )
    selected = exactly_relevant_candidates(candidates, unsaved_scenario)[:5]
    selected_ids = []
    if len(selected) < 5:
        selected_ids = await select_relevant_flashcard_ids(
            unsaved_scenario,
            [candidate for candidate in candidates if candidate not in selected],
            max_count=5 - len(selected),
        )
    candidates_by_id = {candidate.flashcard_id: candidate for candidate in candidates}
    selected.extend(
        candidates_by_id[flashcard_id]
        for flashcard_id in dict.fromkeys(selected_ids)
        if flashcard_id in candidates_by_id
        and candidates_by_id[flashcard_id] not in selected
    )
    selected = selected[:5]
    existing_words = [
        answer
        for answer in db.exec(select(Flashcard.answer)).all()
        if isinstance(answer, str) and answer.strip()
    ]
    try:
        suggested_new = await generate_new_target_suggestions(
            title=req.title,
            description=req.description,
            difficulty=req.difficulty,
            excluded_words=[
                *existing_words,
                *req.selected_targets,
            ],
        )
    except Exception:
        logger.exception("New scenario target suggestion failed")
        suggested_new = []
    return ScenarioRecommendationsResponse(
        existing_cards=[
            ExistingCardRecommendation(
                flashcard_id=target.flashcard_id or "",
                word=target.word,
                pinyin=target.pinyin,
                sentence=target.sentence,
                difficulty_score=target.srs_difficulty,
            )
            for target in selected
        ],
        suggested_new=[SuggestedNewTarget(**suggestion) for suggestion in suggested_new],
    )


@router.post("/roleplay/scenarios/card-draft", response_model=CardDraftResponse)
async def create_card_draft(req: CardDraftRequest) -> CardDraftResponse:
    try:
        draft = await generate_card_draft(**req.model_dump())
    except Exception as error:
        logger.exception("Scenario card draft generation failed")
        raise HTTPException(
            status_code=502,
            detail="Unable to generate a valid card draft",
        ) from error
    return CardDraftResponse(**draft)


@router.post(
    "/roleplay/scenarios",
    response_model=ScenarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_scenario(
    req: ScenarioCreate,
    db: Session = Depends(get_session),
) -> ScenarioResponse:
    if has_active_title(db, req.title):
        raise HTTPException(
            status_code=409,
            detail="An active scenario with this title already exists",
        )
    scenario = Scenario(
        title=req.title,
        description=req.description,
        difficulty=req.difficulty,
        target_grammar=encode_targets(req.target_grammar),
        example_prompt=req.example_prompt,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario_response(scenario)


@router.get("/roleplay/scenarios/{scenario_id}", response_model=ScenarioResponse)
def get_scenario(
    scenario_id: uuid.UUID,
    db: Session = Depends(get_session),
) -> ScenarioResponse:
    scenario = active_scenario(db, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario_response(scenario)


@router.put("/roleplay/scenarios/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(
    scenario_id: uuid.UUID,
    req: ScenarioUpdate,
    db: Session = Depends(get_session),
) -> ScenarioResponse:
    scenario = active_scenario(db, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if has_active_title(db, req.title, excluding_id=scenario.id):
        raise HTTPException(
            status_code=409,
            detail="An active scenario with this title already exists",
        )
    apply_payload(scenario, req)
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario_response(scenario)


@router.delete(
    "/roleplay/scenarios/{scenario_id}",
    response_model=ScenarioArchiveResponse,
)
def archive_scenario(
    scenario_id: uuid.UUID,
    db: Session = Depends(get_session),
) -> ScenarioArchiveResponse:
    scenario = active_scenario(db, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    scenario.archived_at = now
    scenario.updated_at = now
    db.add(scenario)
    db.commit()
    return ScenarioArchiveResponse(scenario_id=scenario.id)


@router.post("/roleplay/start", response_model=RoleplayStartResponse)
async def start_roleplay(
    req: RoleplayStartRequest,
    request: Request,
    db: Session = Depends(get_session),
) -> RoleplayStartResponse:
    scenario = active_scenario(db, req.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    try:
        selected_targets = await select_targets(
            db,
            scenario,
            requested_flashcard_ids=req.target_flashcard_ids,
            scenario_target_words=req.scenario_target_words,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    forced_tokens = [target.word for target in selected_targets]

    profile_stmt = (
        select(UserVocabularyState, Flashcard)
        .join(Flashcard, UserVocabularyState.flashcard_id == Flashcard.id)
        .where(UserVocabularyState.difficulty_score <= 0.5)
    )
    known = list(db.exec(profile_stmt).all())
    known_vocab = [flashcard.answer for _, flashcard in known if flashcard.answer]
    if not known_vocab:
        known_vocab = ["你好", "谢谢", "请", "我", "你", "是", "好", "不"]
    known_vocab = list(dict.fromkeys([*known_vocab, *forced_tokens]))

    roleplay_session = RoleplaySession(
        scenario_id=scenario.id,
        scenario_title=scenario.title,
        scenario_description=scenario.description,
        scenario_difficulty=scenario.difficulty,
        scenario_target_grammar=scenario.target_grammar,
    )
    db.add(roleplay_session)
    db.commit()
    db.refresh(roleplay_session)

    target_rows = persist_session_targets(db, roleplay_session.id, selected_targets)

    state = create_session(
        session_id=roleplay_session.id,
        scenario_id=scenario.id,
        scenario_title=scenario.title,
        scenario_description=scenario.description,
        forced_tokens=forced_tokens,
        known_vocab=known_vocab,
        targets=[
            SessionTarget(
                id=row.id,
                flashcard_id=row.flashcard_id,
                word=row.target_text,
                pinyin=row.target_pinyin,
                sentence=selected_targets[index].sentence,
                source=row.source,
            )
            for index, row in enumerate(target_rows)
        ],
    )

    try:
        greeting_text, greeting_pinyin = await generate_greeting(
            scenario_title=scenario.title,
            scenario_description=scenario.description,
            forced_tokens=forced_tokens,
            known_vocab=known_vocab,
        )
        greeting_audio = await synthesize_speech(greeting_text)
    except Exception as error:
        delete_session(roleplay_session.id)
        for target_row in target_rows:
            db.delete(target_row)
        db.commit()
        db.delete(roleplay_session)
        db.commit()
        logger.exception("Roleplay session preparation failed")
        raise HTTPException(
            status_code=503,
            detail="Roleplay service is temporarily unavailable",
        ) from error
    audio_b64 = base64.b64encode(greeting_audio).decode()

    state.messages.append({"role": "assistant", "content": greeting_text})

    greeting_log = ChatLog(
        session_id=roleplay_session.id,
        sender="tars",
        text_content=greeting_text,
    )
    db.add(greeting_log)
    db.commit()

    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    forwarded_host = request.headers.get("x-forwarded-host", request.url.netloc)
    websocket_scheme = "wss" if forwarded_proto == "https" else "ws"

    return RoleplayStartResponse(
        session_id=roleplay_session.id,
        websocket_url=(
            f"{websocket_scheme}://{forwarded_host}/api/roleplay/stream/"
            f"{roleplay_session.id}"
        ),
        scenario=scenario_response(scenario),
        forced_tokens=forced_tokens,
        initial_greeting=InitialGreeting(
            text=greeting_text,
            pinyin=greeting_pinyin,
            audio_b64=audio_b64,
        ),
    )


@router.post("/roleplay/targets", response_model=RoleplayTargetsResponse)
async def get_roleplay_targets(
    req: RoleplayTargetsRequest,
    db: Session = Depends(get_session),
) -> RoleplayTargetsResponse:
    scenario = active_scenario(db, req.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    targets = await select_targets(
        db,
        scenario,
        semantic_selector=select_relevant_flashcard_ids,
    )
    return RoleplayTargetsResponse(
        focus_words=[
            FocusWord(
                flashcard_id=target.flashcard_id,
                word=target.word,
                pinyin=target.pinyin,
                sentence=target.sentence,
                source=target.source,
            )
            for target in targets
        ]
    )


@router.websocket("/roleplay/stream/{session_id}")
async def stream_roleplay(
    websocket: WebSocket,
    session_id: uuid.UUID,
    db: Session = Depends(get_session),
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

    try:
        while True:
            raw = await websocket.receive_json()
            event_type = raw.get("event_type", "")

            if event_type == "user_speech":
                await _handle_user_speech(websocket, state, raw, db)
            elif event_type == "request_hint":
                try:
                    RequestHintEvent(**raw)
                except ValidationError:
                    await websocket.send_json(
                        ErrorEvent(
                            message="提示请求无效。",
                            recoverable=True,
                            error_code="INVALID_HINT_EVENT",
                        ).model_dump()
                    )
                    continue
                await _handle_hint(websocket, state, db)
            else:
                await websocket.send_json(
                    ErrorEvent(
                        message="不支持的消息类型。",
                        recoverable=True,
                        error_code="UNKNOWN_EVENT_TYPE",
                    ).model_dump()
                )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception:
        logger.exception("WebSocket error for session %s", session_id)
        try:
            await websocket.send_json(
                ErrorEvent(
                    message="会话连接出现问题，请重新进入。",
                    recoverable=False,
                    error_code="SESSION_CONNECTION_ERROR",
                ).model_dump()
            )
        except Exception:
            pass


async def _handle_user_speech(
    websocket: WebSocket,
    state: SessionState,
    raw: dict,
    db: Session,
) -> None:
    try:
        event = UserSpeechEvent(**raw)
    except ValidationError:
        await websocket.send_json(
            ErrorEvent(
                message="语音消息无效，请重试。",
                recoverable=True,
                error_code="INVALID_SPEECH_EVENT",
            ).model_dump()
        )
        return

    try:
        audio_bytes = base64.b64decode(event.audio_chunk_b64, validate=True)
        if not audio_bytes or len(audio_bytes) > 8_000_000:
            raise ValueError("Invalid audio size")
        filename_by_mime_type = {
            "audio/mp4": "audio.m4a",
            "audio/m4a": "audio.m4a",
            "audio/webm": "audio.webm",
            "audio/wav": "audio.wav",
            "audio/x-wav": "audio.wav",
        }
        filename = filename_by_mime_type.get(event.audio_mime_type, "audio.m4a")
        user_text = (await transcribe_audio(audio_bytes, filename)).strip()
        if not user_text:
            raise ValueError("Empty transcript")
    except (ValueError, binascii.Error):
        await websocket.send_json(
            ErrorEvent(
                message="没有听清楚，请再说一次。",
                recoverable=True,
                error_code="INVALID_AUDIO",
            ).model_dump()
        )
        return
    except Exception:
        logger.exception("Speech transcription failed for session %s", state.session_id)
        await websocket.send_json(
            ErrorEvent(
                message="语音识别暂时不可用，请重试。",
                recoverable=True,
                error_code="TRANSCRIPTION_FAILED",
            ).model_dump()
        )
        return

    state.messages.append({"role": "user", "content": user_text})

    user_log = ChatLog(
        session_id=state.session_id,
        sender="user",
        text_content=user_text,
    )
    db.add(user_log)
    db.commit()
    db.refresh(user_log)

    evaluated_target = state.current_target
    target_used = bool(evaluated_target and evaluated_target in user_text)
    target_metadata = state.current_target_metadata
    target_flashcard_id = target_metadata.flashcard_id if target_metadata else None
    if target_flashcard_id:
        db.add(
            TurnEvaluation(
                chat_log_id=user_log.id,
                target_flashcard_id=target_flashcard_id,
                grammar_passed=target_used,
            )
        )
        db.commit()

    if target_metadata:
        record_attempt(db, target_metadata.id, target_used)

    try:
        ai_text, ai_pinyin = await generate_response(
            messages=state.messages,
            scenario_description=state.scenario_description,
            current_target=evaluated_target,
            failure_count=state.failure_count,
            failure_threshold=state.failure_threshold,
            known_vocab=state.known_vocab,
            remaining_targets=state.remaining_targets,
        )
    except Exception:
        logger.exception("Response generation failed for session %s", state.session_id)
        await websocket.send_json(
            ErrorEvent(
                message="回复生成失败，请重试。",
                recoverable=True,
                error_code="RESPONSE_GENERATION_FAILED",
            ).model_dump()
        )
        return

    state.messages.append({"role": "assistant", "content": ai_text})
    state.turn_count += 1

    ai_log = ChatLog(
        session_id=state.session_id,
        sender="tars",
        text_content=ai_text,
    )
    db.add(ai_log)
    db.commit()

    grammar_evals = []
    if evaluated_target:
        passed = target_used
        grammar_evals.append(
            GrammarEvaluation(
                target_token=evaluated_target,
                passed=passed,
                feedback_explanation=None if passed else f"你没有使用“{evaluated_target}”。",
            )
        )
        if passed:
            if evaluated_target not in state.user_passed_tokens:
                state.user_passed_tokens.append(evaluated_target)
            if evaluated_target in state.user_failed_tokens:
                state.user_failed_tokens.remove(evaluated_target)
            state.rotate_target()
        else:
            state.failure_count += 1
            if evaluated_target not in state.user_failed_tokens:
                state.user_failed_tokens.append(evaluated_target)
            if state.failure_count >= state.failure_threshold:
                state.rotate_target()

    try:
        tts_audio = await synthesize_speech(ai_text)
    except Exception:
        logger.exception("Speech synthesis failed for session %s", state.session_id)
        tts_audio = b""
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
    db: Session,
) -> None:
    target = state.current_target
    if not target:
        await websocket.send_json(
            ErrorEvent(
                message="当前没有可用的提示。",
                recoverable=True,
                error_code="NO_HINT_AVAILABLE",
            ).model_dump()
        )
        return
    target_metadata = state.current_target_metadata
    if target_metadata:
        record_hint(db, target_metadata.id)
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
        raise HTTPException(status_code=404, detail="Session not found")

    target_rows = finalize_targets(db, req.session_id)

    passed = [target.target_text for target in target_rows if target.status == "passed"]
    failed = [target.target_text for target in target_rows if target.status == "failed"]
    summary = SessionSummary(
        total_turns=state.turn_count,
        tokens_forced=[target.target_text for target in target_rows],
        tokens_passed=passed,
        tokens_failed=failed,
        targets=[
            TargetOutcome(
                id=target.id,
                flashcard_id=target.flashcard_id,
                word=target.target_text,
                source=target.source,
                status=target.status,
                attempts=target.attempts,
                hints_used=target.hints_used,
            )
            for target in target_rows
        ],
    )

    return RoleplayEndResponse(
        status="success",
        message=f"Session closed. {state.turn_count} turns logged.",
        session_summary=summary,
    )
