from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AdminUser
from app.security import (
    CurrentAdmin,
    clear_auth_cookie,
    hash_password,
    set_auth_cookie,
    verify_password,
)

router = APIRouter(prefix="/admin/auth", tags=["admin"])

# Verified against when the email is unknown so response timing doesn't reveal which emails exist.
_DUMMY_HASH = hash_password("timing-equaliser")


class LoginIn(BaseModel):
    # Plain string: login only has to match a stored account, not validate deliverability.
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str


@router.post("/login", response_model=AdminOut)
async def login(
    data: LoginIn, response: Response, session: Annotated[AsyncSession, Depends(get_session)]
):
    admin = await session.scalar(
        select(AdminUser).where(func.lower(AdminUser.email) == data.email.lower())
    )
    valid = verify_password(data.password, admin.password_hash if admin else _DUMMY_HASH)
    if admin is None or not valid or not admin.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    set_auth_cookie(response, admin.id)
    return admin


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    clear_auth_cookie(response)


@router.get("/me", response_model=AdminOut)
async def me(admin: CurrentAdmin):
    return admin
