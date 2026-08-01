from __future__ import annotations

import json
import uuid
import base64
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.roleplay import ChatLog, RoleplaySession, TurnEvaluation
from app.models.scenario import Scenario
from app.services.session_store import create_session, delete_session


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


class TestRoleplayWebSocket:
    def test_rejects_unknown_event(self, client: TestClient) -> None:
        session_id = uuid.uuid4()
        create_session(
            session_id=session_id,
            scenario_id=uuid.uuid4(),
            scenario_title="测试",
            scenario_description="测试",
            forced_tokens=["菜单"],
            known_vocab=["我", "要"],
        )
        try:
            with client.websocket_connect(
                f"/api/roleplay/stream/{session_id}"
            ) as websocket:
                websocket.send_json({"event_type": "unknown"})
                event = websocket.receive_json()
                assert event["event_type"] == "error"
                assert event["error_code"] == "UNKNOWN_EVENT_TYPE"
        finally:
            delete_session(session_id)

    def test_speech_turn_persists_logs_and_evaluation(
        self,
        client: TestClient,
        db_session: Session,
        create_flashcard,
    ) -> None:
        scenario = Scenario(
            title="点菜测试",
            description="测试",
            difficulty="beginner",
            target_grammar=json.dumps(["菜单"]),
        )
        db_session.add(scenario)
        db_session.flush()
        roleplay_session = RoleplaySession(scenario_id=scenario.id)
        db_session.add(roleplay_session)
        db_session.commit()
        db_session.refresh(roleplay_session)
        flashcard = create_flashcard(answer="菜单")

        create_session(
            session_id=roleplay_session.id,
            scenario_id=scenario.id,
            scenario_title=scenario.title,
            scenario_description=scenario.description,
            forced_tokens=["菜单"],
            known_vocab=["我", "要", "菜单"],
            target_flashcard_ids={"菜单": flashcard.id},
        )

        try:
            with (
                patch(
                    "app.routers.roleplay.transcribe_audio",
                    new=AsyncMock(return_value="我想要菜单"),
                ),
                patch(
                    "app.routers.roleplay.generate_response",
                    new=AsyncMock(return_value=("好的，给您菜单。", "hǎo de")),
                ),
                patch(
                    "app.routers.roleplay.synthesize_speech",
                    new=AsyncMock(return_value=b"mp3"),
                ),
                client.websocket_connect(
                    f"/api/roleplay/stream/{roleplay_session.id}"
                ) as websocket,
            ):
                websocket.send_json(
                    {
                        "event_type": "user_speech",
                        "audio_chunk_b64": base64.b64encode(b"audio").decode(),
                        "audio_mime_type": "audio/mp4",
                    }
                )
                event = websocket.receive_json()
                assert event["event_type"] == "tars_response"
                assert event["transcribed_user_text"] == "我想要菜单"
                assert event["grammar_evaluations"][0]["passed"] is True

            logs = list(
                db_session.exec(
                    select(ChatLog).where(
                        ChatLog.session_id == roleplay_session.id
                    )
                ).all()
            )
            evaluations = list(db_session.exec(select(TurnEvaluation)).all())
            assert [log.sender for log in logs] == ["user", "tars"]
            assert len(evaluations) == 1
            assert evaluations[0].target_flashcard_id == flashcard.id
            assert evaluations[0].grammar_passed is True
        finally:
            delete_session(roleplay_session.id)
            for evaluation in db_session.exec(select(TurnEvaluation)).all():
                db_session.delete(evaluation)
            db_session.commit()
