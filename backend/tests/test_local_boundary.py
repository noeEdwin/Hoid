from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings


def test_default_backend_bind_is_loopback() -> None:
    config = Settings(_env_file=None)

    assert config.HOST == "127.0.0.1"
    assert config.PORT == 8000


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.10", "example.test"])
def test_remote_backend_bind_is_rejected(host: str) -> None:
    with pytest.raises(ValueError, match="remote binds are disabled"):
        Settings(_env_file=None, HOST=host)


def test_localhost_bind_is_allowed() -> None:
    assert Settings(_env_file=None, HOST="localhost").HOST == "localhost"
    assert Settings(_env_file=None, HOST="::1").HOST == "::1"


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
