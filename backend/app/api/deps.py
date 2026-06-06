from typing import Callable, Set
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.db.models import User
from app.db.session import get_db


def normalize_role(name: str) -> str:
    """Normalize role name to lowercase for comparison."""
    raw = (name or "").strip().lower()
    return raw


def get_user_role_names(user: User, db: Session) -> Set[str]:
    """
    Get all role names for a user:
    1. Direct roles assigned to user (USER_ROLES)
    2. Roles inherited through groups (USER_GROUPS -> ROLE_GROUPS -> roles)
    """
    role_names: Set[str] = set()
    
    # Get direct roles
    if user.roles:
        role_names.update({normalize_role(r.name) for r in user.roles})
    
    # Get roles through groups
    if user.groups:
        for group in user.groups:
            if group.roles:
                role_names.update({normalize_role(r.name) for r in group.roles})
    
    return role_names


def require_any_role(*role_names: str) -> Callable:
    """Require user to have at least one of the specified roles (direct or through groups)."""
    def _checker(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        user_role_names = get_user_role_names(user, db)
        required = {normalize_role(r) for r in role_names}
        
        if not user_role_names.intersection(required):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role. Required one of: {', '.join(role_names)}. User has: {', '.join(user_role_names) or 'none'}"
            )
        return user

    return _checker


