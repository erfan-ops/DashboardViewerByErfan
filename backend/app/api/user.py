from typing import Set
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db
from app.db.models import User
from app.api.auth import get_current_user
from app.api.deps import get_user_role_names


router = APIRouter(prefix="/user", tags=["user"])

@router.get("/roles", response_model=Set[str])
def get_user_roles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_user_role_names(user, db)
