from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm import (
    _build_system_prompt,
    _to_pinyin,
    generate_greeting,
    generate_response,
)


def _stream_chunk(content: str | None) -> MagicMock:
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = content
    return chunk


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


def _mock_chat_response(text: str = "你好！") -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = text
    return response


def _mock_stream_response(chunks: list[str]) -> MagicMock:
    response = _AsyncIterator([_stream_chunk(c) for c in chunks])
    return response


class TestToPinyin:
    def test_converts_chinese(self) -> None:
        result = _to_pinyin("你好")
        assert isinstance(result, str)
        assert "nǐ" in result
        assert "hǎo" in result

    def test_handles_empty_string(self) -> None:
        result = _to_pinyin("")
        assert result == ""

    def test_handles_mixed_text(self) -> None:
        result = _to_pinyin("你好世界")
        assert "nǐ" in result
        assert "hǎo" in result
        assert "shì" in result or "shí" in result
        assert "jiè" in result


class TestBuildSystemPrompt:
    def test_includes_scenario(self) -> None:
        prompt = _build_system_prompt(
            scenario_description="在咖啡店点咖啡",
            known_vocab=["你好", "咖啡"],
        )
        assert "在咖啡店点咖啡" in prompt

    def test_includes_known_vocab(self) -> None:
        prompt = _build_system_prompt(
            scenario_description="测试",
            known_vocab=["你好", "咖啡", "谢谢"],
        )
        assert "你好" in prompt
        assert "咖啡" in prompt
        assert "谢谢" in prompt

    def test_enforces_mandarin_only(self) -> None:
        prompt = _build_system_prompt(
            scenario_description="测试",
            known_vocab=["你好"],
        )
        assert "只用中文" in prompt or "中文" in prompt

    def test_includes_target_when_provided(self) -> None:
        prompt = _build_system_prompt(
            scenario_description="测试",
            known_vocab=["你好", "咖啡"],
            current_target="咖啡",
            failure_count=0,
            remaining_targets=["谢谢"],
        )
        assert "咖啡" in prompt

    def test_no_target_when_none(self) -> None:
        prompt = _build_system_prompt(
            scenario_description="测试",
            known_vocab=["你好"],
        )
        assert "当前教学目标" not in prompt


class TestGenerateGreeting:
    async def test_returns_tuple(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_mock_chat_response("你好！欢迎光临。")
            )
            mock_get.return_value = mock_client
            text, pinyin = await generate_greeting(
                scenario_title="咖啡店",
                scenario_description="在咖啡店",
                forced_tokens=["咖啡"],
                known_vocab=["你好", "咖啡"],
            )
            assert isinstance(text, str)
            assert isinstance(pinyin, str)

    async def test_includes_pinyin(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_mock_chat_response("你好！")
            )
            mock_get.return_value = mock_client
            _, pinyin = await generate_greeting(
                scenario_title="测试",
                scenario_description="测试场景",
                forced_tokens=[],
                known_vocab=["你好"],
            )
            assert "nǐ" in pinyin

    async def test_sends_correct_model(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_mock_chat_response("ok")
            )
            mock_get.return_value = mock_client
            await generate_greeting(
                scenario_title="t",
                scenario_description="d",
                forced_tokens=[],
                known_vocab=[],
            )
            call_kwargs = mock_client.chat.completions.create.call_args
            assert call_kwargs.kwargs["model"] == "gpt-4o-mini"


class TestGenerateResponse:
    async def test_returns_tuple(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_mock_stream_response(["你好", "！"])
            )
            mock_get.return_value = mock_client
            text, pinyin = await generate_response(
                messages=[{"role": "user", "content": "你好"}],
                scenario_description="测试",
                current_target="咖啡",
                failure_count=0,
                failure_threshold=3,
                known_vocab=["你好", "咖啡"],
                remaining_targets=["谢谢"],
            )
            assert isinstance(text, str)
            assert isinstance(pinyin, str)

    async def test_concatenates_stream_chunks(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_mock_stream_response(["我", "要", "咖啡"])
            )
            mock_get.return_value = mock_client
            text, _ = await generate_response(
                messages=[{"role": "user", "content": "菜单"}],
                scenario_description="测试",
                current_target="咖啡",
                failure_count=0,
                failure_threshold=3,
                known_vocab=["我", "要", "咖啡"],
                remaining_targets=[],
            )
            assert text == "我要咖啡"

    async def test_includes_chat_history(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_mock_stream_response(["ok"])
            )
            mock_get.return_value = mock_client
            history = [
                {"role": "user", "content": "你好"},
                {"role": "assistant", "content": "你好！"},
                {"role": "user", "content": "我要咖啡"},
            ]
            await generate_response(
                messages=history,
                scenario_description="测试",
                current_target="咖啡",
                failure_count=0,
                failure_threshold=3,
                known_vocab=["你好", "我", "要", "咖啡"],
                remaining_targets=[],
            )
            call_kwargs = mock_client.chat.completions.create.call_args
            messages_sent = call_kwargs.kwargs["messages"]
            assert len(messages_sent) == 4
            assert messages_sent[0]["role"] == "system"
            assert messages_sent[1:] == history

    async def test_uses_streaming(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_mock_stream_response(["ok"])
            )
            mock_get.return_value = mock_client
            await generate_response(
                messages=[{"role": "user", "content": "hi"}],
                scenario_description="test",
                current_target="test",
                failure_count=0,
                failure_threshold=3,
                known_vocab=["hi", "test"],
                remaining_targets=[],
            )
            call_kwargs = mock_client.chat.completions.create.call_args
            assert call_kwargs.kwargs["stream"] is True

    async def test_handles_api_error(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                side_effect=Exception("API error")
            )
            mock_get.return_value = mock_client
            with pytest.raises(Exception, match="API error"):
                await generate_response(
                    messages=[],
                    scenario_description="test",
                    current_target="test",
                    failure_count=0,
                    failure_threshold=3,
                    known_vocab=[],
                    remaining_targets=[],
                )

    async def test_retries_on_failure(self) -> None:
        with patch("app.services.llm._get_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat.completions.create = AsyncMock(
                side_effect=[
                    Exception("transient"),
                    _mock_stream_response(["ok"]),
                ]
            )
            mock_get.return_value = mock_client
            with patch("app.services.llm.asyncio.sleep", new_callable=AsyncMock):
                text, _ = await generate_response(
                    messages=[],
                    scenario_description="test",
                    current_target="test",
                    failure_count=0,
                    failure_threshold=3,
                    known_vocab=[],
                    remaining_targets=[],
                )
                assert text == "ok"


class TestGenerateGreetingLive:
    @pytest.mark.integration
    async def test_live_greeting(self) -> None:
        text, pinyin = await generate_greeting(
            scenario_title="在咖啡店",
            scenario_description="你是一位咖啡店的店员，正在为客人点单。",
            forced_tokens=["咖啡", "要"],
            known_vocab=["你好", "咖啡", "要", "请", "谢谢", "菜单"],
        )
        assert len(text) > 0
        assert len(pinyin) > 0
        assert any(t in text for t in ["咖啡", "要"])


class TestGenerateResponseLive:
    @pytest.mark.integration
    async def test_live_response_forces_vocabulary(self) -> None:
        text, pinyin = await generate_response(
            messages=[{"role": "user", "content": "你好，我想看看菜单"}],
            scenario_description="你是一位咖啡店的店员，正在为客人点单。",
            current_target="咖啡",
            failure_count=0,
            failure_threshold=3,
            known_vocab=["你好", "咖啡", "要", "请", "谢谢", "菜单", "茶"],
            remaining_targets=["要", "茶"],
        )
        assert len(text) > 0
        assert "咖啡" in text

    @pytest.mark.integration
    async def test_live_response_rotates_after_failures(self) -> None:
        text, pinyin = await generate_response(
            messages=[
                {"role": "user", "content": "我不要咖啡"},
                {"role": "assistant", "content": "好的，那您要什么呢？"},
                {"role": "user", "content": "不知道"},
                {"role": "assistant", "content": "我们有茶和咖啡，您想要哪个？"},
                {"role": "user", "content": "我还是不要咖啡"},
            ],
            scenario_description="你是一位咖啡店的店员，正在为客人点单。",
            current_target="咖啡",
            failure_count=3,
            failure_threshold=3,
            known_vocab=["你好", "咖啡", "要", "请", "谢谢", "茶", "好"],
            remaining_targets=["要", "茶"],
        )
        assert len(text) > 0
        assert "咖啡" not in text
        assert any(t in text for t in ["要", "茶"])
