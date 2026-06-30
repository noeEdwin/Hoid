from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import select

from app.core.config import settings
from app.core.database import get_session, init_db
from app.models.flashcard import Deck, Flashcard, UserVocabularyState
from app.models.scenario import Scenario
from app.routers import flashcards, roleplay, sync, test_page, tts, vocabulary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _seed_scenarios() -> None:
    db = next(get_session())
    existing = db.exec(select(Scenario).where(Scenario.title == "在咖啡店")).first()
    if existing is None:
        scenario = Scenario(
            title="在咖啡店",
            description="你是一位咖啡店的店员，正在为客人点单。客人走进店里，你要热情地招呼他们。",
            difficulty="beginner",
            target_grammar=json.dumps(["咖啡", "要", "请"]),
            example_prompt="你好，欢迎光临！",
        )
        db.add(scenario)
        db.commit()
        logger.info("Seeded scenario: 在咖啡店")
    db.close()


def _seed_flashcards() -> None:
    db = next(get_session())
    existing = db.exec(select(Deck).where(Deck.name == "Starter Deck")).first()
    if existing is None:
        seed_path = Path(__file__).parent.parent / "seed_data" / "starter-deck.json"
        with open(seed_path) as f:
            cards = json.load(f)

        deck_obj = Deck(name="Starter Deck", description="Initial cloze deletion cards")
        db.add(deck_obj)
        db.flush()

        for card_data in cards:
            card = Flashcard(deck_id=deck_obj.id, **card_data)
            db.add(card)
            db.flush()
            vocab = UserVocabularyState(flashcard_id=card.id)
            db.add(vocab)

        db.commit()
        logger.info(f"Seeded {len(cards)} flashcards in Starter Deck")
    db.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized.")
    _seed_scenarios()
    _seed_flashcards()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
