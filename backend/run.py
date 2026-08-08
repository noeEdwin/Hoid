from __future__ import annotations

import argparse
import logging
import os
import sys

import uvicorn

logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local-only Tars backend")
    parser.add_argument("--reload", action="store_true")
    parser.add_argument(
        "--lan",
        action="store_true",
        help="explicitly allow a development LAN bind configured by HOST",
    )
    args = parser.parse_args()
    if args.lan:
        os.environ["ALLOW_LAN"] = "true"

    from app.core.config import settings

    if args.lan and settings.HOST not in {"localhost", "127.0.0.1", "::1"}:
        logger.warning("LAN mode is enabled for development only; do not use production data")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=args.reload,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
