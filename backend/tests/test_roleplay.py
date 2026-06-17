from __future__ import annotations

import json
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.scenario import Scenario


class TestListScenarios:
    def test_empty_initially(self, client: TestClient) -> None:
        r = client.get("/api/roleplay/scenarios")
        assert r.status_code == 200
        assert r.json()["scenarios"] == []

    def test_returns_all(self, client: TestClient, db_session: Session) -> None:
        for i in range(3):
            scenario = Scenario(
                title=f"Scenario {i}",
                description=f"Description {i}",
                difficulty="beginner",
                target_grammar=json.dumps(["了", "把"]),
            )
            db_session.add(scenario)
        db_session.commit()
        r = client.get("/api/roleplay/scenarios")
        assert len(r.json()["scenarios"]) == 3

    def test_filter_by_difficulty(self, client: TestClient, db_session: Session) -> None:
        db_session.add(Scenario(
            title="Easy",
            description="Easy scenario",
            difficulty="beginner",
            target_grammar=json.dumps(["了"]),
        ))
        db_session.add(Scenario(
            title="Hard",
            description="Hard scenario",
            difficulty="advanced",
            target_grammar=json.dumps(["把", "了", "要"]),
        ))
        db_session.commit()
        r = client.get("/api/roleplay/scenarios?difficulty=beginner")
        scenarios = r.json()["scenarios"]
        assert len(scenarios) == 1
        assert scenarios[0]["title"] == "Easy"

    def test_target_grammar_is_list(self, client: TestClient, db_session: Session) -> None:
        db_session.add(Scenario(
            title="Test",
            description="Test scenario",
            difficulty="beginner",
            target_grammar=json.dumps(["把", "了", "要"]),
        ))
        db_session.commit()
        r = client.get("/api/roleplay/scenarios")
        grammar = r.json()["scenarios"][0]["target_grammar"]
        assert isinstance(grammar, list)
        assert grammar == ["把", "了", "要"]
