import os
import logging
from contextlib import contextmanager
from typing import Generator
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("vehicle_rental.database")

DATABASE_URL = os.getenv("DATABASE_URL")

pool: ConnectionPool | None = None

def init_db_pool() -> ConnectionPool:
    global pool
    if pool is None:
        logger.info("Initializing PostgreSQL connection pool...")
        
        pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=2,
            max_size=15,
            kwargs={
                "row_factory": dict_row,
            },
            open=True,
        )
    return pool

def close_db_pool() -> None:
    global pool
    if pool is not None:
        logger.info("Closing PostgreSQL connection pool...")
        pool.close()
        pool = None

@contextmanager
def get_db_connection() -> Generator[psycopg.Connection, None, None]:
    """Context manager for standalone scripts or non-FastAPI dependency tasks."""
    global pool
    if pool is None:
        init_db_pool()
    with pool.connection() as conn:
        yield conn

def get_db() -> Generator[psycopg.Connection, None, None]:
    """FastAPI dependency for injecting database connection."""
    global pool
    if pool is None:
        init_db_pool()
    with pool.connection() as conn:
        try:
            yield conn
        finally:
            pass

def check_db_health() -> bool:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 as alive;")
                row = cur.fetchone()
                return bool(row and row.get("alive") == 1)
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False