from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.tts import synthesize_speech


def _audio_chunk(data: bytes = b"audio-bytes") -> dict:
    return {"type": "audio", "data": data}


def _boundary_chunk(chunk_type: str = "WordBoundary") -> dict:
    return {"type": chunk_type, "text": "word"}


class _AsyncIterator:
    def __init__(self, items: list) -> None:
        self._items = iter(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration


class TestSynthesizeSpeech:
    async def test_returns_bytes(self) -> None:
        with patch("app.services.tts.edge_tts.Communicate") as mock_comm:
            instance = mock_comm.return_value
            instance.stream.return_value = _AsyncIterator([_audio_chunk()])
            result = await synthesize_speech("你好")
            assert isinstance(result, bytes)

    async def test_collects_audio_chunks(self) -> None:
        with patch("app.services.tts.edge_tts.Communicate") as mock_comm:
            instance = mock_comm.return_value
            instance.stream.return_value = _AsyncIterator([
                _audio_chunk(b"hello"),
                _audio_chunk(b"world"),
            ])
            result = await synthesize_speech("你好世界")
            assert result == b"helloworld"

    async def test_skips_non_audio_chunks(self) -> None:
        with patch("app.services.tts.edge_tts.Communicate") as mock_comm:
            instance = mock_comm.return_value
            instance.stream.return_value = _AsyncIterator([
                _boundary_chunk("WordBoundary"),
                _audio_chunk(b"real-audio"),
                _boundary_chunk("SentenceBoundary"),
            ])
            result = await synthesize_speech("你好")
            assert result == b"real-audio"

    async def test_passes_voice_config(self) -> None:
        with patch("app.services.tts.edge_tts.Communicate") as mock_comm:
            instance = mock_comm.return_value
            instance.stream.return_value = _AsyncIterator([_audio_chunk()])
            await synthesize_speech("测试")
            mock_comm.assert_called_once_with(
                "测试",
                voice="zh-CN-XiaoxiaoNeural",
                rate="+0%",
                volume="+0%",
            )

    async def test_retries_on_failure(self) -> None:
        with patch("app.services.tts.edge_tts.Communicate") as mock_comm:
            instance = mock_comm.return_value
            instance.stream.side_effect = [
                Exception("network error"),
                _AsyncIterator([_audio_chunk(b"ok")]),
            ]
            with patch("app.services.tts.asyncio.sleep", new_callable=AsyncMock):
                result = await synthesize_speech("重试")
                assert result == b"ok"

    async def test_exhausts_retries_then_raises(self) -> None:
        with patch("app.services.tts.edge_tts.Communicate") as mock_comm:
            instance = mock_comm.return_value
            instance.stream.side_effect = Exception("persistent error")
            with (
                patch("app.services.tts.asyncio.sleep", new_callable=AsyncMock),
                pytest.raises(Exception, match="persistent error"),
            ):
                await synthesize_speech("失败")
            assert instance.stream.call_count == 3


class TestSynthesizeSpeechLive:
    @pytest.mark.integration
    async def test_live_synthesize(self) -> None:
        result = await synthesize_speech("你好，世界")
        assert isinstance(result, bytes)
        assert len(result) > 100
