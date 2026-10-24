from typing import Annotated, Literal

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.media import delete_image, save_image
from app.models import AppearanceSettings
from app.schemas.appearance import AppearanceIn, AppearanceOut
from app.security import require_admin

router = APIRouter(
    prefix="/admin/appearance", tags=["admin"], dependencies=[Depends(require_admin)]
)
public = APIRouter(prefix="/appearance", tags=["appearance"])

Session = Annotated[AsyncSession, Depends(get_session)]
# The images an admin can replace: the home page photo and the shop's logo, light and dark.
Slot = Literal["hero", "logo", "logo-dark"]
_FIELDS: dict[str, str] = {
    "hero": "hero_image_path",
    "logo": "logo_image_path",
    "logo-dark": "logo_dark_image_path",
}


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
    return row or AppearanceSettings(id=1, logo_height=40)


@router.get("", response_model=AppearanceOut)
async def get_appearance(session: Session):
    row = await _settings(session)
    await session.commit()
    return row


@router.patch("", response_model=AppearanceOut)
async def update_appearance(data: AppearanceIn, session: Session):
    row = await _settings(session)
    for field, value in data.model_dump().items():
        setattr(row, field, value)
    await session.commit()
    return row


@router.post("/{slot}-image", response_model=AppearanceOut)
async def upload_appearance_image(slot: Slot, file: UploadFile, session: Session):
    row = await _settings(session)
    field = _FIELDS[slot]
    old = getattr(row, field)
    setattr(row, field, await save_image(file, "appearance"))
    await session.commit()
    delete_image(old)
    return row


@router.delete("/{slot}-image", response_model=AppearanceOut)
async def reset_appearance_image(slot: Slot, session: Session):
    """Back to the image shipped with the frontend. The dark logo only replaces the light one, so
    resetting the light logo drops it too."""
    row = await _settings(session)
    fields = [_FIELDS[slot]] + (["logo_dark_image_path"] if slot == "logo" else [])
    old = [getattr(row, field) for field in fields]
    for field in fields:
        setattr(row, field, None)
    await session.commit()
    for path in old:
        delete_image(path)
    return row
