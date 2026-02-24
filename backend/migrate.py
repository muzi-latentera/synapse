#!/usr/bin/env python3
import logging

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _to_sync_url(db_url: str) -> str:
    if db_url.startswith("postgresql+asyncpg://"):
        return db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    if db_url.startswith("sqlite+aiosqlite:///"):
        return db_url.replace("sqlite+aiosqlite:///", "sqlite:///", 1)
    return db_url


def check_and_run_migrations():
    settings = get_settings()
    db_url = _to_sync_url(settings.DATABASE_URL)
    is_production = settings.ENVIRONMENT.lower() == "production"

    engine = create_engine(db_url)

    try:
        with engine.connect():
            inspector = inspect(engine)
            tables = inspector.get_table_names()

            alembic_cfg = Config("alembic.ini")
            alembic_cfg.set_main_option("sqlalchemy.url", db_url)

            if "alembic_version" not in tables and "users" in tables:
                command.stamp(alembic_cfg, "head")

            command.upgrade(alembic_cfg, "head")

    except Exception as e:
        logger.error("Migration failed: %s", e)
        if is_production or settings.DESKTOP_MODE:
            logger.error("Migration failed in strict mode. Aborting startup.")
            raise
        logger.error("Continuing in non-production environment...")
    finally:
        engine.dispose()


if __name__ == "__main__":
    check_and_run_migrations()
