"""
Role-based authorization resolution.

Pure business logic — no HTTP or FastAPI dependency.
Extracted from api/deps.py so the dependency module only wires
FastAPI dependencies together.
"""

from typing import Set
from sqlalchemy.orm import Session
from app.db.models import User


def normalize_role(name: str) -> str:
    """Normalize role name to lowercase for case-insensitive comparison."""
    return (name or "").strip().lower()


def get_user_role_names(user: User, db: Session) -> Set[str]:
    """
    Return all effective role names for *user*.

    Effective roles = direct roles ∪ group-inherited roles.
    """
    role_names: Set[str] = set()

    if user.roles:
        role_names.update({normalize_role(r.name) for r in user.roles})

    if user.groups:
        for group in user.groups:
            if group.roles:
                role_names.update({normalize_role(r.name) for r in group.roles})

    return role_names
