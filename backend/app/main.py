from __future__ import annotations

import logging
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import select

from app.core.config import settings
from app.core.database import get_session, init_db
from app.models.scenario import Scenario
from app.routers import flashcards, roleplay, sync, test_page, tts, vocabulary
from app.services.scenarios import encode_targets, normalize_title

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _reject_direct_remote_bind() -> None:
    host_argument = next(
        (argument for argument in sys.argv if argument.startswith("--host=")),
        None,
    )
    if host_argument is not None:
        host = host_argument.split("=", 1)[1]
    elif "--host" in sys.argv:
        host_index = sys.argv.index("--host")
        if host_index + 1 >= len(sys.argv):
            return
        host = sys.argv[host_index + 1]
    else:
        return
    if host.strip().lower() not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError(
            "remote uvicorn binds are disabled; use `python run.py --lan` for development LAN mode"
        )


_reject_direct_remote_bind()


def _seed_scenarios() -> None:
    db = next(get_session())
    existing_scenarios = list(db.exec(select(Scenario)).all())
    existing_titles = {normalize_title(scenario.title) for scenario in existing_scenarios}
    existing_seed_keys = {
        scenario.seed_key for scenario in existing_scenarios if scenario.seed_key
    }
    scenarios = [
        (
            "cafe",
            "在咖啡店",
            "你在咖啡店点饮料，店员会询问杯型、温度和其他偏好。",
            "beginner",
            ["咖啡", "要", "请"],
            "你好，欢迎光临！今天想喝点什么？",
        ),
        (
            "restaurant",
            "在餐馆点菜",
            "你是餐馆里的顾客，需要看菜单、点菜并询问价格。",
            "beginner",
            ["想要", "菜单", "一共"],
            "您好，这是菜单。请问想吃点什么？",
        ),
        (
            "directions",
            "问路",
            "你在陌生的街区问路，需要理解方向和地点说明。",
            "beginner",
            ["请问", "怎么走", "附近"],
            "你好，需要我帮你指路吗？",
        ),
        (
            "hotel",
            "酒店入住",
            "你到酒店办理入住，确认预订并提出房间需求。",
            "intermediate",
            ["预订", "入住", "可以"],
            "您好，欢迎来到酒店。请问您有预订吗？",
        ),
        (
            "doctor",
            "看医生",
            "你向医生描述身体不适，并回答关于症状的问题。",
            "intermediate",
            ["不舒服", "已经", "疼"],
            "你好，哪里不舒服？",
        ),
    ]
    for seed_key, title, description, difficulty, targets, example_prompt in scenarios:
        if seed_key not in existing_seed_keys and normalize_title(title) not in existing_titles:
            db.add(
                Scenario(
                    seed_key=seed_key,
                    title=title,
                    description=description,
                    difficulty=difficulty,
                    target_grammar=encode_targets(targets),
                    example_prompt=example_prompt,
                )
            )
            existing_titles.add(normalize_title(title))
            existing_seed_keys.add(seed_key)
    db.commit()
    db.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    init_db()
    _seed_scenarios()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Content-Type"],
)

app.include_router(flashcards.router, prefix="/api")
app.include_router(vocabulary.router, prefix="/api")
app.include_router(roleplay.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(tts.router, prefix="/api")
app.include_router(test_page.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
