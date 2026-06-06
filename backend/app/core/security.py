from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import jwt
from passlib.context import CryptContext
from app.core.config import get_settings
import bcrypt


# BCrypt with workload 12 (2^12 = 4096 rounds) to match Java BCrypt.gensalt(12)
# BCrypt hashes are cross-language compatible - verification works regardless of creation language
pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12, deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against BCrypt hash (compatible with Java BCrypt).
    BCrypt hashes are standardized and work across languages.
    """
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(subject: str, expires_delta_minutes: Optional[int] = None) -> str:
    settings = get_settings()
    expire_minutes = expires_delta_minutes or settings.access_token_expire_minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


