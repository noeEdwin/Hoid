from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.models.scenario import Scenario
from app.schemas.roleplay import ScenarioListResponse, ScenarioResponse

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
