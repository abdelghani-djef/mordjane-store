from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Cookie, Depends, HTTPException, Response, status
from pwdlib import PasswordHash
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import AdminUser

COOKIE_NAME = "mj_admin"
ALGORITHM = "HS256"

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_token(admin_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(admin_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def set_auth_cookie(response: Response, admin_id: int) -> None:
    settings = get_settings()
    response.set_cookie(
        COOKIE_NAME,
        create_token(admin_id),
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


_unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


async def require_admin(
    session: Annotated[AsyncSession, Depends(get_session)],
    token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> AdminUser:
    if not token:
        raise _unauthorized
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
        admin_id = int(payload["sub"])
    except jwt.PyJWTError, KeyError, ValueError:
        raise _unauthorized from None
    admin = await session.get(AdminUser, admin_id)
    if admin is None or not admin.is_active:
        raise _unauthorized
    return admin


CurrentAdmin = Annotated[AdminUser, Depends(require_admin)]
