from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

_TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "test_roleplay.html"


@router.get("/test", response_class=HTMLResponse)
async def test_page() -> HTMLResponse:
    return HTMLResponse(content=_TEMPLATE_PATH.read_text(encoding="utf-8"))
