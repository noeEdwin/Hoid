from __future__ import annotations

from pydantic import BaseModel


class LLMMessage(BaseModel):
    role: str
    content: str


class TurnContext(BaseModel):
    current_target: str
    failure_count: int
    failure_threshold: int = 3
    remaining_targets: list[str]


class LLMResponse(BaseModel):
    text: str
    pinyin: str
