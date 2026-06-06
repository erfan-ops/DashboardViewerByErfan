import bcrypt
from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from app.db.session import get_db
from app.db.models import User
from app.schemas import UserOut, Token, LoginRequest
from app.core.security import verify_password, create_access_token
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

# keep the same tokenUrl so the frontend still hits /auth/login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class UserRegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    confirm_password: str


@router.post("/register")
def register(
    username: str = Form(...),
    email: EmailStr = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.username == username).first()
    db_email = db.query(User).filter(User.email == email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User \"{username}\" already exists."
        )
    elif db_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email \"{email}\" is already registered."
        )
    elif password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Passwords did not match!!!"
        )

    # u = User(username=username, email=email, password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)), role="ROLE_USER")
    # db.add(u)
    # db.commit()
    # db.refresh(u)
    # return u
    
    with db.bind.connect() as conn:
        conn.execute(
            text("INSERT INTO USERS (ID, USERNAME, EMAIL, PASSWORD_HASH, ROLE) VALUES (user_id_seq.nextval, :username, :email, :password_hash, :role)"),
            {
                "username": username,
                "email": email,
                "password_hash": bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8"),
                "role": "ROLE_USER",
            })
        conn.commit()
    
    return {"status": "ok"}


@router.post("/login", response_model=Token)
def login(
    background_tasks: BackgroundTasks,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == username).first()
    if not user or user.enabled != 1 or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    access_token = create_access_token(subject=str(user.id))
    
    
    def background_work(user_id):
        with db.bind.connect() as bg_conn:
            # Update UPDATED_AT column
            bg_conn.execute(
                text("UPDATE USERS SET LAST_LOGIN = SYSTIMESTAMP WHERE ID = :id"),
                {"id": user_id}
            )
            bg_conn.execute(
                text("UPDATE USERS SET UPDATEED_AT = SYSTIMESTAMP WHERE ID = :id"),
                {"id": user_id}
            )
            bg_conn.commit()
    
    background_tasks.add_task(background_work, user.id)
    
    return Token(access_token=access_token)


def get_current_user(db: Session = Depends(get_db),
                     token: str = Depends(oauth2_scheme)) -> User:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user