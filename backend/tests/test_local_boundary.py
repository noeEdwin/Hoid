from __future__ import annotations

import sys

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import _reject_direct_remote_bind


def test_default_backend_bind_is_loopback() -> None:
    config = Settings(_env_file=None)

    assert config.HOST == "127.0.0.1"
    assert config.PORT == 8000


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.10", "example.test"])
def test_remote_backend_bind_is_rejected(host: str) -> None:
    with pytest.raises(ValueError, match="remote binds are disabled"):
        Settings(_env_file=None, HOST=host)


def test_development_lan_bind_is_rejected() -> None:
    with pytest.raises(ValueError, match="remote binds are disabled"):
        Settings(_env_file=None, HOST="192.168.3.11")


def test_production_lan_bind_is_rejected() -> None:
    with pytest.raises(ValueError, match="remote binds are disabled"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            HOST="192.168.3.11",
        )


@pytest.mark.parametrize("host_argument", ["--host", "--host=0.0.0.0"])
def test_direct_uvicorn_remote_bind_is_rejected(
    monkeypatch: pytest.MonkeyPatch, host_argument: str
) -> None:
    argv = ["uvicorn", "app.main:app", host_argument]
    if host_argument == "--host":
        argv.append("0.0.0.0")
    monkeypatch.setattr(sys, "argv", argv)

    with pytest.raises(RuntimeError, match="remote uvicorn binds are disabled"):
        _reject_direct_remote_bind()


def test_localhost_bind_is_allowed() -> None:
    assert Settings(_env_file=None, HOST="localhost").HOST == "localhost"
    assert Settings(_env_file=None, HOST="::1").HOST == "::1"


def test_uvicorn_environment_remote_bind_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UVICORN_HOST", "0.0.0.0")

    with pytest.raises(RuntimeError, match="remote uvicorn binds are disabled"):
        _reject_direct_remote_bind()


def test_cors_allows_local_development_origin_and_rejects_other_origins(
    client: TestClient,
) -> None:
    allowed = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET",
        },
    )
    rejected = client.options(
        "/health",
        headers={
            "Origin": "https://example.test",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:8081"
    assert "access-control-allow-origin" not in rejected.headers


def test_cors_does_not_enable_credentials(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.headers.get("access-control-allow-credentials") != "true"
