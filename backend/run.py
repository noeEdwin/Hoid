from __future__ import annotations

import argparse
import logging

import uvicorn

logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local-only Tars backend")
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    from app.core.config import settings

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=args.reload,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
