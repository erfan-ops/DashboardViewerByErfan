"""
Lightweight helpers for raw-SQL execution against the Oracle database.

Centralises the ``db.bind.connect()`` pattern that is duplicated across
several API modules so that connection handling can be tuned in one place.
"""

from typing import Any, Dict, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session


def execute(sql: str, db: Session, params: Optional[Dict[str, Any]] = None):
    """Execute a raw SQL statement and return the cursor result."""
    with db.bind.connect() as conn:
        return conn.execute(text(sql), params or {})


def execute_and_fetch(sql: str, db: Session, params: Optional[Dict[str, Any]] = None):
    """Execute a raw SQL SELECT and return all rows."""
    result = execute(sql, db, params)
    return result.fetchall()


def execute_and_commit(sql: str, db: Session, params: Optional[Dict[str, Any]] = None):
    """Execute a raw SQL INSERT / UPDATE / DELETE and commit."""
    with db.bind.connect() as conn:
        conn.execute(text(sql), params or {})
        conn.commit()
