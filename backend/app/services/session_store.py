from __future__ import annotations

import uuid
from dataclasses import dataclass, field


@dataclass
class SessionState:
    session_id: uuid.UUID
    scenario_id: uuid.UUID
    scenario_title: str
    scenario_description: str
    messages: list[dict] = field(default_factory=list)
    current_target: str = ""
    failure_count: int = 0
    failure_threshold: int = 3
    remaining_targets: list[str] = field(default_factory=list)
    known_vocab: list[str] = field(default_factory=list)
    forced_tokens: list[str] = field(default_factory=list)
    turn_count: int = 0
    user_passed_tokens: list[str] = field(default_factory=list)
    user_failed_tokens: list[str] = field(default_factory=list)


_sessions: dict[uuid.UUID, SessionState] = {}


def create_session(
    session_id: uuid.UUID,
    scenario_id: uuid.UUID,
    scenario_title: str,
    scenario_description: str,
    forced_tokens: list[str],
    known_vocab: list[str],
) -> SessionState:
    state = SessionState(
        session_id=session_id,
        scenario_id=scenario_id,
        scenario_title=scenario_title,
        scenario_description=scenario_description,
        current_target=forced_tokens[0] if forced_tokens else "",
        remaining_targets=forced_tokens[1:] if len(forced_tokens) > 1 else [],
        known_vocab=known_vocab,
        forced_tokens=forced_tokens,
    )
    _sessions[session_id] = state
    return state


def get_session_state(session_id: uuid.UUID) -> SessionState | None:
    return _sessions.get(session_id)


def delete_session(session_id: uuid.UUID) -> SessionState | None:
    return _sessions.pop(session_id, None)


def list_sessions() -> list[SessionState]:
    return list(_sessions.values())
