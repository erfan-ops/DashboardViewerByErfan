from typing import List, Optional
from pydantic import BaseModel, EmailStr


class RoleOut(BaseModel):
    id: int
    name: str
    description: str

    class Config:
        from_attributes = True


class GroupOut(BaseModel):
    id: int
    name: str
    description: str

    class Config:
        from_attributes = True


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


class LoginRequest(BaseModel):
    username: str
    password: str


class OAuth2Form(BaseModel):
    username: str   # OAuth2 spec calls it “username” even if we use it as login
    password: str


