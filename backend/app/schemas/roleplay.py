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
