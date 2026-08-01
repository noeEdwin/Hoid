from __future__ import annotations

import uuid
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SessionTarget:
    id: uuid.UUID
    flashcard_id: str | None
    word: str
    pinyin: str | None
    sentence: str | None
    source: str


@dataclass
class SessionState:
    session_id: uuid.UUID
    scenario_id: uuid.UUID
    scenario_title: str
    scenario_description: str
    messages: list[dict] = field(default_factory=list)
    failure_count: int = 0
    failure_threshold: int = 3
    known_vocab: list[str] = field(default_factory=list)
    forced_tokens: list[str] = field(default_factory=list)
    targets: list[SessionTarget] = field(default_factory=list)
    target_index: int = 0
    turn_count: int = 0
    user_passed_tokens: list[str] = field(default_factory=list)
    user_failed_tokens: list[str] = field(default_factory=list)

    @property
    def current_target_metadata(self) -> SessionTarget | None:
        if self.target_index >= len(self.targets):
            return None
        return self.targets[self.target_index]

    @property
    def current_target(self) -> str:
        target = self.current_target_metadata
        return target.word if target else ""

    @property
    def remaining_targets(self) -> list[str]:
        return [target.word for target in self.targets[self.target_index + 1 :]]

    def rotate_target(self) -> None:
        self.target_index += 1
        self.failure_count = 0


_sessions: dict[uuid.UUID, SessionState] = {}


def create_session(
    session_id: uuid.UUID,
    scenario_id: uuid.UUID,
    scenario_title: str,
    scenario_description: str,
    forced_tokens: list[str],
    known_vocab: list[str],
    target_flashcard_ids: dict[str, str] | None = None,
    targets: list[SessionTarget] | None = None,
) -> SessionState:
    if targets is None:
        target_flashcard_ids = target_flashcard_ids or {}
        targets = [
            SessionTarget(
                id=uuid.uuid4(),
                flashcard_id=target_flashcard_ids.get(word),
                word=word,
                pinyin=None,
                sentence=None,
                source="flashcard" if word in target_flashcard_ids else "scenario",
            )
            for word in forced_tokens
        ]
    state = SessionState(
        session_id=session_id,
        scenario_id=scenario_id,
        scenario_title=scenario_title,
        scenario_description=scenario_description,
        known_vocab=known_vocab,
        forced_tokens=forced_tokens,
        targets=targets,
    )
    _sessions[session_id] = state
    return state


def get_session_state(session_id: uuid.UUID) -> SessionState | None:
    return _sessions.get(session_id)


def delete_session(session_id: uuid.UUID) -> SessionState | None:
    return _sessions.pop(session_id, None)


def list_sessions() -> list[SessionState]:
    return list(_sessions.values())
