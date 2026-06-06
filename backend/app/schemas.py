from typing import List, Optional
from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    enabled: int
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


