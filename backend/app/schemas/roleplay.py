from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


Difficulty = Literal["beginner", "intermediate", "advanced"]


class ScenarioPayload(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=1000)
    difficulty: Difficulty
    target_grammar: list[str] = Field(min_length=1, max_length=10)
    example_prompt: str | None = Field(default=None, max_length=300)

    @field_validator("title", "description", mode="before")
    @classmethod
    def trim_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("example_prompt", mode="before")
    @classmethod
    def trim_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("target_grammar", mode="before")
    @classmethod
    def normalize_targets(cls, value: object) -> object:
        if not isinstance(value, list):
            return value
        targets: list[object] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, str):
                targets.append(item)
                continue
            target = item.strip()
            if not target or target in seen:
                continue
            if len(target) > 40:
                raise ValueError("Target grammar items must be at most 40 characters")
            seen.add(target)
            targets.append(target)
        return targets


class ScenarioCreate(ScenarioPayload):
    pass


class ScenarioUpdate(ScenarioPayload):
    pass


class ScenarioResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    difficulty: Difficulty
    target_grammar: list[str]
    example_prompt: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

    model_config = {"from_attributes": True}


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioResponse]


class ScenarioArchiveResponse(BaseModel):
    status: Literal["archived"] = "archived"
    scenario_id: uuid.UUID


class ScenarioRecommendationsRequest(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=1000)
    difficulty: Difficulty
    selected_targets: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("title", "description", mode="before")
    @classmethod
    def trim_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("selected_targets", mode="before")
    @classmethod
    def normalize_selected_targets(cls, value: object) -> object:
        if not isinstance(value, list):
            return value
        result: list[object] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, str):
                result.append(item)
                continue
            target = item.strip()
            if not target or target in seen:
                continue
            if len(target) > 40:
                raise ValueError("Selected targets must be at most 40 characters")
            seen.add(target)
            result.append(target)
        return result


class ExistingCardRecommendation(BaseModel):
    flashcard_id: str
    word: str
    pinyin: str | None
    sentence: str | None
    difficulty_score: float


class SuggestedNewTarget(BaseModel):
    word: str
    pinyin: str
    reason: str
    suggested_structure: str


class ScenarioRecommendationsResponse(BaseModel):
    existing_cards: list[ExistingCardRecommendation]
    suggested_new: list[SuggestedNewTarget]


class CardDraftRequest(BaseModel):
    scenario_title: str = Field(min_length=1, max_length=80)
    scenario_description: str = Field(min_length=1, max_length=1000)
    word: str = Field(min_length=1, max_length=40)
    pinyin: str | None = Field(default=None, max_length=100)

    @field_validator("scenario_title", "scenario_description", "word", mode="before")
    @classmethod
    def trim_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("pinyin", mode="before")
    @classmethod
    def trim_pinyin(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class CardDraftResponse(BaseModel):
    answer: str
    answer_pinyin: str
    sentence: str
    sentence_pinyin: str
    context: str
    context_pinyin: str


class RoleplayStartRequest(BaseModel):
    scenario_id: uuid.UUID
    target_flashcard_ids: list[str] | None = Field(default=None, max_length=3)
    scenario_target_words: list[str] | None = Field(default=None, max_length=3)


class RoleplayTargetsRequest(BaseModel):
    scenario_id: uuid.UUID


class FocusWord(BaseModel):
    flashcard_id: str | None
    word: str
    pinyin: str | None
    sentence: str | None
    source: Literal["flashcard", "scenario"]


class RoleplayTargetsResponse(BaseModel):
    focus_words: list[FocusWord]


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
    event_type: Literal["tars_response"] = "tars_response"
    transcribed_user_text: str
    grammar_evaluations: list[GrammarEvaluation]
    ai_text_reply: str
    ai_pinyin: str
    ai_audio_b64: str
    difficulty_adjusted: str | None = None


class HintResponseEvent(BaseModel):
    event_type: Literal["hint_response"] = "hint_response"
    hint_text: str
    suggested_structure: str


class ErrorEvent(BaseModel):
    event_type: Literal["error"] = "error"
    message: str
    recoverable: bool
    error_code: str = "ROLEPLAY_ERROR"


class UserSpeechEvent(BaseModel):
    event_type: Literal["user_speech"] = "user_speech"
    audio_chunk_b64: str = Field(min_length=1, max_length=12_000_000)
    audio_mime_type: str = Field(default="audio/mp4", max_length=100)


class RequestHintEvent(BaseModel):
    event_type: Literal["request_hint"] = "request_hint"


class RoleplayEndRequest(BaseModel):
    session_id: uuid.UUID


class TargetOutcome(BaseModel):
    id: uuid.UUID
    flashcard_id: str | None
    word: str
    source: Literal["flashcard", "scenario"]
    status: Literal["pending", "passed", "failed", "unattempted"]
    attempts: int
    hints_used: int


class SessionSummary(BaseModel):
    total_turns: int
    tokens_forced: list[str]
    tokens_passed: list[str]
    tokens_failed: list[str]
    targets: list[TargetOutcome] = Field(default_factory=list)


class RoleplayEndResponse(BaseModel):
    status: str
    message: str
    session_summary: SessionSummary
