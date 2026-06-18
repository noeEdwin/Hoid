from __future__ import annotations

import base64
import json
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlmodel import select

from app.models.scenario import Scenario
from app.services.session_store import create_session, delete_session, get_session_state
from app.services import session_store


class TestSessionStore:
    def test_create_and_get(self, db_session) -> None:
        sid = uuid.uuid4()
        state = create_session(
            session_id=sid,
            scenario_id=uuid.uuid4(),
            scenario_title="test",
            scenario_description="desc",
            forced_tokens=["咖啡"],
            known_vocab=["你好", "咖啡"],
        )
        assert state.session_id == sid
        assert state.current_target == "咖啡"
        assert get_session_state(sid) is state

    def test_delete_session(self, db_session) -> None:
        sid = uuid.uuid4()
        create_session(
            session_id=sid,
            scenario_id=uuid.uuid4(),
            scenario_title="test",
            scenario_description="desc",
            forced_tokens=["咖啡"],
            known_vocab=["你好"],
        )
        deleted = delete_session(sid)
        assert deleted is not None
        assert get_session_state(sid) is None

    def test_delete_nonexistent(self) -> None:
        result = delete_session(uuid.uuid4())
        assert result is None


class TestStartRoleplay:
    @pytest.mark.integration
    async def test_start_returns_greeting(self, client, db_session) -> None:
        scenario = Scenario(
            title="测试场景",
            description="测试",
            difficulty="beginner",
            target_grammar=json.dumps(["你好"]),
            example_prompt="你好！",
        )
        db_session.add(scenario)
        db_session.commit()
        db_session.refresh(scenario)

        response = client.post(
            "/api/roleplay/start",
            json={"scenario_id": str(scenario.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "websocket_url" in data
        assert "initial_greeting" in data
        assert data["initial_greeting"]["text"]
        assert data["initial_greeting"]["audio_b64"]
        assert data["forced_tokens"]

        audio_bytes = base64.b64decode(data["initial_greeting"]["audio_b64"])
        assert len(audio_bytes) > 100

        delete_session(uuid.UUID(data["session_id"]))

    @pytest.mark.integration
    async def test_start_404_on_bad_scenario(self, client) -> None:
        response = client.post(
            "/api/roleplay/start",
            json={"scenario_id": str(uuid.uuid4())},
        )
        assert response.status_code == 404


class TestEndRoleplay:
    @pytest.mark.integration
    async def test_end_returns_summary(self, client, db_session) -> None:
        scenario = Scenario(
            title="结束测试",
            description="测试",
            difficulty="beginner",
            target_grammar=json.dumps(["好"]),
            example_prompt="好！",
        )
        db_session.add(scenario)
        db_session.commit()
        db_session.refresh(scenario)

        start_resp = client.post(
            "/api/roleplay/start",
            json={"scenario_id": str(scenario.id)},
        )
        session_id = start_resp.json()["session_id"]

        end_resp = client.post(
            "/api/roleplay/end",
            json={"session_id": session_id},
        )
        assert end_resp.status_code == 200
        data = end_resp.json()
        assert data["status"] == "success"
        assert "session_summary" in data
        assert data["session_summary"]["total_turns"] == 0

    @pytest.mark.integration
    async def test_end_404_on_bad_session(self, client) -> None:
        response = client.post(
            "/api/roleplay/end",
            json={"session_id": str(uuid.uuid4())},
        )
        assert response.status_code == 404
