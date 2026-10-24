from typing import Annotated, Literal

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.media import delete_image, save_image
from app.models import AppearanceSettings
from app.schemas.appearance import AppearanceOut
from app.security import require_admin

router = APIRouter(
    prefix="/admin/appearance", tags=["admin"], dependencies=[Depends(require_admin)]
)
public = APIRouter(prefix="/appearance", tags=["appearance"])

Session = Annotated[AsyncSession, Depends(get_session)]
# The images an admin can replace: the home page photo and the shop's logo.
Slot = Literal["hero", "logo"]


async def _settings(session: AsyncSession) -> AppearanceSettings:
    """The settings row, created empty the first time it's needed."""
    row = await session.get(AppearanceSettings, 1)
    if row is None:
        row = AppearanceSettings(id=1)
        session.add(row)
        await session.flush()
    return row


@public.get("", response_model=AppearanceOut)
async def get_public_appearance(session: Session):
    row = await session.get(AppearanceSettings, 1)
    return row or AppearanceSettings(id=1)


@router.get("", response_model=AppearanceOut)
async def get_appearance(session: Session):
    row = await _settings(session)
    await session.commit()
    return row


@router.post("/{slot}-image", response_model=AppearanceOut)
async def upload_appearance_image(slot: Slot, file: UploadFile, session: Session):
    row = await _settings(session)
    field = f"{slot}_image_path"
    old = getattr(row, field)
    setattr(row, field, await save_image(file, "appearance"))
    await session.commit()
    delete_image(old)
    return row


@router.delete("/{slot}-image", response_model=AppearanceOut)
async def reset_appearance_image(slot: Slot, session: Session):
    """Back to the image shipped with the frontend."""
    row = await _settings(session)
    field = f"{slot}_image_path"
    old = getattr(row, field)
    setattr(row, field, None)
    await session.commit()
    delete_image(old)
    return row
