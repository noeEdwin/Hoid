from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlmodel import Session, create_engine, select

from app.models.flashcard import Deck, Flashcard, UserVocabularyState
from app.models.roleplay import RoleplaySession
from app.models.scenario import Scenario
from app.services.llm import generate_card_draft, generate_new_target_suggestions


def _payload(title: str = "  买火车票  ") -> dict:
    return {
        "title": title,
        "description": "  在车站买票。  ",
        "difficulty": "intermediate",
        "target_grammar": [" 车票 ", "", "车票", "出发"],
        "example_prompt": "  您去哪里？  ",
    }


def _scenario(db: Session, title: str = "旧场景") -> Scenario:
    scenario = Scenario(
        title=title,
        description="旧描述",
        difficulty="beginner",
        target_grammar=json.dumps(["旧词"], ensure_ascii=False),
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


def _eligible_card(db: Session, word: str) -> tuple[Flashcard, UserVocabularyState]:
    deck = Deck(name=f"Deck {word}")
    db.add(deck)
    db.flush()
    card = Flashcard(
        deck_id=deck.id,
        answer=word,
        answer_pinyin=f"{word} pinyin",
        sentence=f"我要___（{word}）",
    )
    db.add(card)
    db.flush()
    state = UserVocabularyState(
        flashcard_id=card.id,
        total_reviews=2,
        difficulty_score=0.9,
    )
    db.add(state)
    db.commit()
    db.refresh(card)
    db.refresh(state)
    return card, state


def test_create_normalizes_and_validates(client: TestClient) -> None:
    response = client.post("/api/roleplay/scenarios", json=_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "买火车票"
    assert body["description"] == "在车站买票。"
    assert body["target_grammar"] == ["车票", "出发"]
    assert body["example_prompt"] == "您去哪里？"
    assert body["created_at"] and body["updated_at"]

    invalid = _payload("Valid")
    invalid["target_grammar"] = ["  "]
    assert client.post("/api/roleplay/scenarios", json=invalid).status_code == 422
    invalid["difficulty"] = "expert"
    assert client.post("/api/roleplay/scenarios", json=invalid).status_code == 422


def test_normalized_active_title_conflicts(client: TestClient) -> None:
    assert client.post("/api/roleplay/scenarios", json=_payload("Train   Station")).status_code == 201
    assert client.post("/api/roleplay/scenarios", json=_payload(" train station ")).status_code == 409


def test_update_replaces_fields_and_timestamp(
    client: TestClient,
    db_session: Session,
) -> None:
    scenario = _scenario(db_session)
    previous_updated_at = scenario.updated_at

    response = client.put(f"/api/roleplay/scenarios/{scenario.id}", json=_payload())

    assert response.status_code == 200
    assert response.json()["target_grammar"] == ["车票", "出发"]
    db_session.refresh(scenario)
    assert scenario.title == "买火车票"
    assert scenario.updated_at >= previous_updated_at


def test_archive_preserves_history_and_hides_resource(
    client: TestClient,
    db_session: Session,
) -> None:
    scenario = _scenario(db_session)
    history = RoleplaySession(
        scenario_id=scenario.id,
        scenario_title=scenario.title,
        scenario_description=scenario.description,
        scenario_difficulty=scenario.difficulty,
        scenario_target_grammar=scenario.target_grammar,
    )
    db_session.add(history)
    db_session.commit()

    response = client.delete(f"/api/roleplay/scenarios/{scenario.id}")

    assert response.status_code == 200
    assert response.json() == {"status": "archived", "scenario_id": str(scenario.id)}
    assert client.get("/api/roleplay/scenarios").json()["scenarios"] == []
    assert client.get(f"/api/roleplay/scenarios/{scenario.id}").status_code == 404
    assert client.put(f"/api/roleplay/scenarios/{scenario.id}", json=_payload()).status_code == 404
    assert client.delete(f"/api/roleplay/scenarios/{scenario.id}").status_code == 404
    assert db_session.get(RoleplaySession, history.id) is not None
    db_session.refresh(scenario)
    assert scenario.archived_at is not None


def test_archived_title_can_be_reused_by_user(client: TestClient, db_session: Session) -> None:
    scenario = _scenario(db_session, "可重用")
    assert client.delete(f"/api/roleplay/scenarios/{scenario.id}").status_code == 200
    assert client.post("/api/roleplay/scenarios", json=_payload("可重用")).status_code == 201


def test_seed_does_not_recreate_archived_builtin(db_session: Session) -> None:
    archived = _scenario(db_session, "在咖啡店")
    archived.archived_at = archived.updated_at
    db_session.add(archived)
    db_session.commit()

    from app.main import _seed_scenarios

    seed_session = Session(db_session.get_bind())
    with patch("app.main.get_session", return_value=iter([seed_session])):
        _seed_scenarios()

    rows = db_session.exec(select(Scenario).where(Scenario.title == "在咖啡店")).all()
    assert len(rows) == 1


def test_seed_does_not_recreate_renamed_builtin(db_session: Session) -> None:
    renamed = _scenario(db_session, "我的咖啡练习")
    renamed.seed_key = "cafe"
    db_session.add(renamed)
    db_session.commit()

    from app.main import _seed_scenarios

    seed_session = Session(db_session.get_bind())
    with patch("app.main.get_session", return_value=iter([seed_session])):
        _seed_scenarios()

    original = db_session.exec(
        select(Scenario).where(Scenario.title == "在咖啡店")
    ).first()
    assert original is None


def test_roleplay_start_snapshots_scenario(
    client: TestClient,
    db_session: Session,
) -> None:
    scenario = _scenario(db_session, "快照场景")
    with (
        patch(
            "app.routers.roleplay.generate_greeting",
            new=AsyncMock(return_value=("你好", "nǐ hǎo")),
        ),
        patch(
            "app.routers.roleplay.synthesize_speech",
            new=AsyncMock(return_value=b"mp3"),
        ),
    ):
        response = client.post(
            "/api/roleplay/start",
            json={"scenario_id": str(scenario.id)},
        )

    assert response.status_code == 200
    session = db_session.get(RoleplaySession, uuid.UUID(response.json()["session_id"]))
    assert session is not None
    assert session.scenario_title == "快照场景"
    assert session.scenario_description == "旧描述"
    assert session.scenario_difficulty == "beginner"
    assert json.loads(session.scenario_target_grammar or "[]") == ["旧词"]


def test_recommendations_validate_ids_dedupe_and_do_not_mutate_srs(
    client: TestClient,
    db_session: Session,
) -> None:
    card, state = _eligible_card(db_session, "车票")
    before = state.model_dump()
    suggestions = [
        {
            "word": "售票处",
            "pinyin": "shòu piào chù",
            "reason": "适合车站场景",
            "suggested_structure": "去 + 售票处",
        }
    ]
    with (
        patch(
            "app.routers.roleplay.select_relevant_flashcard_ids",
            new=AsyncMock(return_value=["invented", card.id, card.id]),
        ),
        patch(
            "app.routers.roleplay.generate_new_target_suggestions",
            new=AsyncMock(return_value=suggestions),
        ),
    ):
        response = client.post(
            "/api/roleplay/scenarios/recommendations",
            json={
                "title": "车站",
                "description": "买票",
                "difficulty": "beginner",
                "selected_targets": [" 出发 ", "出发"],
            },
        )

    assert response.status_code == 200
    assert response.json()["existing_cards"] == [{
        "flashcard_id": card.id,
        "word": "车票",
        "pinyin": "车票 pinyin",
        "sentence": "我要___（车票）",
        "difficulty_score": 0.9,
    }]
    assert response.json()["suggested_new"] == suggestions
    db_session.refresh(state)
    assert state.model_dump() == before


def test_recommendation_suggestion_failure_keeps_existing_cards(
    client: TestClient,
    db_session: Session,
) -> None:
    card, _ = _eligible_card(db_session, "菜单")
    with (
        patch(
            "app.routers.roleplay.select_relevant_flashcard_ids",
            new=AsyncMock(return_value=[card.id]),
        ),
        patch(
            "app.routers.roleplay.generate_new_target_suggestions",
            new=AsyncMock(side_effect=ValueError("malformed")),
        ),
    ):
        response = client.post(
            "/api/roleplay/scenarios/recommendations",
            json={"title": "餐馆", "description": "点菜", "difficulty": "beginner"},
        )

    assert response.status_code == 200
    assert response.json()["existing_cards"][0]["flashcard_id"] == card.id
    assert response.json()["suggested_new"] == []


def test_card_draft_success_and_safe_failure(client: TestClient) -> None:
    draft = {
        "answer": "车票",
        "answer_pinyin": "chē piào",
        "sentence": "我想买一张___。",
        "sentence_pinyin": "wǒ xiǎng mǎi yì zhāng chē piào",
        "context": "在车站买票。",
        "context_pinyin": "zài chē zhàn mǎi piào",
    }
    with patch(
        "app.routers.roleplay.generate_card_draft",
        new=AsyncMock(return_value=draft),
    ):
        response = client.post(
            "/api/roleplay/scenarios/card-draft",
            json={
                "scenario_title": "车站",
                "scenario_description": "买票",
                "word": "车票",
            },
        )
    assert response.status_code == 200
    assert response.json() == draft

    with patch(
        "app.routers.roleplay.generate_card_draft",
        new=AsyncMock(side_effect=ValueError("bad marker")),
    ):
        failed = client.post(
            "/api/roleplay/scenarios/card-draft",
            json={
                "scenario_title": "车站",
                "scenario_description": "买票",
                "word": "车票",
            },
        )
    assert failed.status_code == 502
    assert failed.json() == {"detail": "Unable to generate a valid card draft"}


async def test_llm_suggestions_filter_exclusions_duplicates_and_malformed() -> None:
    response = MagicMock()
    response.choices[0].message.content = json.dumps({
        "suggestions": [
            {"word": "车票", "pinyin": "x", "reason": "x", "suggested_structure": "x"},
            {"word": "站台", "pinyin": "zhàn tái", "reason": "相关", "suggested_structure": "在站台"},
            {"word": "站台", "pinyin": "duplicate", "reason": "x", "suggested_structure": "x"},
            {"word": "缺字段"},
        ]
    }, ensure_ascii=False)
    client = MagicMock()
    client.chat.completions.create = AsyncMock(return_value=response)

    with patch("app.services.llm._get_client", return_value=client):
        suggestions = await generate_new_target_suggestions(
            title="车站",
            description="买票",
            difficulty="beginner",
            excluded_words=["车票"],
        )

    assert suggestions == [{
        "word": "站台",
        "pinyin": "zhàn tái",
        "reason": "相关",
        "suggested_structure": "在站台",
    }]


async def test_llm_card_draft_rejects_invalid_cloze_marker() -> None:
    response = MagicMock()
    response.choices[0].message.content = json.dumps({
        "answer": "车票",
        "answer_pinyin": "chē piào",
        "sentence": "我买车票。",
        "sentence_pinyin": "wǒ mǎi chē piào",
        "context": "买票",
        "context_pinyin": "mǎi piào",
    }, ensure_ascii=False)
    client = MagicMock()
    client.chat.completions.create = AsyncMock(return_value=response)

    with patch("app.services.llm._get_client", return_value=client):
        try:
            await generate_card_draft(
                scenario_title="车站",
                scenario_description="买票",
                word="车票",
                pinyin=None,
            )
        except ValueError as error:
            assert "exactly one" in str(error)
        else:
            raise AssertionError("Invalid draft was accepted")


def test_init_db_migrates_legacy_scenario_and_session_tables() -> None:
    legacy_engine = create_engine("sqlite://")
    scenario_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    with legacy_engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE scenario (id CHAR(32) PRIMARY KEY, title TEXT NOT NULL, "
            "description TEXT NOT NULL, difficulty TEXT NOT NULL, target_grammar TEXT NOT NULL, "
            "example_prompt TEXT, created_at DATETIME)"
        ))
        connection.execute(text(
            "CREATE TABLE roleplay_session (id CHAR(32) PRIMARY KEY, scenario_id CHAR(32) NOT NULL, "
            "started_at DATETIME, ended_at DATETIME)"
        ))
        connection.execute(
            text(
                "INSERT INTO scenario "
                "(id, title, description, difficulty, target_grammar, created_at) "
                "VALUES (:id, 'Legacy', 'Description', 'beginner', '[\"要\"]', "
                "'2026-01-01 00:00:00')"
            ),
            {"id": scenario_id},
        )
        connection.execute(
            text(
                "INSERT INTO roleplay_session (id, scenario_id, started_at) "
                "VALUES (:id, :scenario_id, CURRENT_TIMESTAMP)"
            ),
            {"id": session_id, "scenario_id": scenario_id},
        )

    from app.core.database import init_db

    with patch("app.core.database.engine", legacy_engine):
        init_db()

    inspector = inspect(legacy_engine)
    assert {column["name"] for column in inspector.get_columns("scenario")} >= {
        "updated_at",
        "archived_at",
    }
    assert {column["name"] for column in inspector.get_columns("roleplay_session")} >= {
        "scenario_title",
        "scenario_description",
        "scenario_difficulty",
        "scenario_target_grammar",
    }
    with legacy_engine.connect() as connection:
        scenario_row = connection.execute(text(
            "SELECT updated_at FROM scenario WHERE id = :id"
        ), {"id": scenario_id}).one()
        session_row = connection.execute(text(
            "SELECT scenario_title, scenario_description, scenario_difficulty, "
            "scenario_target_grammar FROM roleplay_session WHERE id = :id"
        ), {"id": session_id}).one()
    assert scenario_row.updated_at == "2026-01-01 00:00:00"
    assert tuple(session_row) == ("Legacy", "Description", "beginner", '["要"]')
