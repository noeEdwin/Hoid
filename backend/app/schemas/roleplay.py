from __future__ import annotations

import uuid

from pydantic import BaseModel


class ScenarioResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    difficulty: str
    target_grammar: list[str]
    example_prompt: str | None

    model_config = {"from_attributes": True}


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioResponse]


class RoleplayStartRequest(BaseModel):
    scenario_id: uuid.UUID


class InitialGreeting(BaseModel):
    text: str
    pinyin: str
    audio_b64: str


class RoleplayStartResponse(BaseModel):
    session_id: uuid.UUID
    websocket_url: str
    scenario: ScenarioResponse
    forced_tokens: list[str]
    initial_greeting: InitialGreeting


class GrammarEvaluation(BaseModel):
    target_token: str
    passed: bool
    feedback_explanation: str | None


class TarsResponseEvent(BaseModel):
    event_type: str = "tars_response"
    transcribed_user_text: str
    grammar_evaluations: list[GrammarEvaluation]
    ai_text_reply: str
    ai_pinyin: str
    ai_audio_b64: str
    difficulty_adjusted: str | None = None


class HintResponseEvent(BaseModel):
    event_type: str = "hint_response"
    hint_text: str
    suggested_structure: str


class ErrorEvent(BaseModel):
    event_type: str = "error"
    message: str
    recoverable: bool


class UserSpeechEvent(BaseModel):
    event_type: str = "user_speech"
    audio_chunk_b64: str


class RequestHintEvent(BaseModel):
    event_type: str = "request_hint"


class RoleplayEndRequest(BaseModel):
    session_id: uuid.UUID


class SessionSummary(BaseModel):
    total_turns: int
    tokens_forced: list[str]
    tokens_passed: list[str]
    tokens_failed: list[str]


class RoleplayEndResponse(BaseModel):
    status: str
    message: str
    session_summary: SessionSummary
