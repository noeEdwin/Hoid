from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from openai import RateLimitError

from app.services.stt import transcribe_audio


def _mock_response(text: str) -> MagicMock:
    resp = MagicMock()
    resp.text = text
    return resp


def _mock_client(create_return: MagicMock | None = None, side_effect: Exception | None = None) -> MagicMock:
    client = MagicMock()
    create_mock = AsyncMock(return_value=create_return)
    if side_effect:
        create_mock.side_effect = side_effect
    client.audio.transcriptions.create = create_mock
    return client


def _rate_limit_response(retry_after: str = "2") -> RateLimitError:
    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.headers = {"retry-after": retry_after}
    mock_resp.json.return_value = {"error": {"message": "rate limit"}}
    return RateLimitError(
        message="rate limit",
        response=mock_resp,
        body={"error": {"message": "rate limit"}},
    )


class TestTranscribeAudio:
    async def test_returns_string(self) -> None:
        client = _mock_client(create_return=_mock_response("你好世界"))
        with patch("app.services.stt._get_client", return_value=client):
            result = await transcribe_audio(b"fake-audio-bytes")
            assert isinstance(result, str)

    async def test_returns_transcribed_text(self) -> None:
        client = _mock_client(create_return=_mock_response("我要一杯咖啡"))
        with patch("app.services.stt._get_client", return_value=client):
            result = await transcribe_audio(b"fake-audio-bytes")
            assert result == "我要一杯咖啡"

    async def test_sends_correct_params(self) -> None:
        client = _mock_client(create_return=_mock_response("测试"))
        with patch("app.services.stt._get_client", return_value=client):
            await transcribe_audio(b"test-audio")
            client.audio.transcriptions.create.assert_called_once()
            call_kwargs = client.audio.transcriptions.create.call_args
            assert call_kwargs.kwargs["model"] == "whisper-large-v3"
            assert call_kwargs.kwargs["language"] == "zh"

    async def test_wraps_bytes_in_bytesio(self) -> None:
        client = _mock_client(create_return=_mock_response("ok"))
        with patch("app.services.stt._get_client", return_value=client):
            await transcribe_audio(b"audio-content")
            file_arg = client.audio.transcriptions.create.call_args.kwargs["file"]
            assert isinstance(file_arg, io.BytesIO)
            assert file_arg.name == "audio.wav"
            assert file_arg.read() == b"audio-content"

    async def test_handles_api_error(self) -> None:
        client = _mock_client(side_effect=Exception("API error"))
        with patch("app.services.stt._get_client", return_value=client):
            with pytest.raises(Exception, match="API error"):
                await transcribe_audio(b"bad-audio")

    async def test_retries_on_rate_limit(self) -> None:
        client = MagicMock()
        create_mock = AsyncMock(
            side_effect=[
                _rate_limit_response("1"),
                _mock_response("成功"),
            ]
        )
        client.audio.transcriptions.create = create_mock
        with (
            patch("app.services.stt._get_client", return_value=client),
            patch("app.services.stt.asyncio.sleep", new_callable=AsyncMock),
        ):
            result = await transcribe_audio(b"audio")
            assert result == "成功"
            assert create_mock.call_count == 2

    async def test_exhausts_retries_then_raises(self) -> None:
        client = MagicMock()
        create_mock = AsyncMock(side_effect=_rate_limit_response("1"))
        client.audio.transcriptions.create = create_mock
        with (
            patch("app.services.stt._get_client", return_value=client),
            patch("app.services.stt.asyncio.sleep", new_callable=AsyncMock),
        ):
            with pytest.raises(RateLimitError):
                await transcribe_audio(b"audio")
            assert create_mock.call_count == 3
