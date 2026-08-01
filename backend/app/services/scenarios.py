from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models.scenario import Scenario
from app.schemas.roleplay import ScenarioPayload, ScenarioResponse


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip()).casefold()


def scenario_targets(scenario: Scenario) -> list[str]:
    try:
        parsed = json.loads(scenario.target_grammar)
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(parsed, list):
        return []
    return list(
        dict.fromkeys(
            value.strip()
            for value in parsed
            if isinstance(value, str) and value.strip()
        )
    )


def encode_targets(targets: list[str]) -> str:
    return json.dumps(targets, ensure_ascii=False)


def scenario_response(scenario: Scenario) -> ScenarioResponse:
    return ScenarioResponse(
        id=scenario.id,
        title=scenario.title,
        description=scenario.description,
        difficulty=scenario.difficulty,
        target_grammar=scenario_targets(scenario),
        example_prompt=scenario.example_prompt,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at,
        archived_at=scenario.archived_at,
    )


def active_scenario(db: Session, scenario_id: uuid.UUID) -> Scenario | None:
    scenario = db.get(Scenario, scenario_id)
    if scenario is None or scenario.archived_at is not None:
        return None
    return scenario


def has_active_title(
    db: Session,
    title: str,
    excluding_id: uuid.UUID | None = None,
) -> bool:
    normalized = normalize_title(title)
    scenarios = db.exec(select(Scenario).where(Scenario.archived_at.is_(None))).all()
    return any(
        scenario.id != excluding_id and normalize_title(scenario.title) == normalized
        for scenario in scenarios
    )


def apply_payload(scenario: Scenario, payload: ScenarioPayload) -> None:
    scenario.title = payload.title
    scenario.description = payload.description
    scenario.difficulty = payload.difficulty
    scenario.target_grammar = encode_targets(payload.target_grammar)
    scenario.example_prompt = payload.example_prompt
    scenario.updated_at = utcnow()
