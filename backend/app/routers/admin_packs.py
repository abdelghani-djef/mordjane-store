from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.media import delete_image, save_image
from app.models import Pack, PackItem, ProductVariant
from app.routers.public_packs import PACK_CONTENTS
from app.schemas.packs import PackAdminOut, PackIn, PackItemIn, PackPatch
from app.security import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

Session = Annotated[AsyncSession, Depends(get_session)]


async def _commit_or_conflict(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A pack with this slug already exists"
        ) from exc


async def _get_pack(session: AsyncSession, pack_id: int) -> Pack:
    pack = await session.scalar(select(Pack).where(Pack.id == pack_id).options(PACK_CONTENTS))
    if pack is None:
        raise HTTPException(404, "Pack not found")
    return pack


async def _pack_out(session: AsyncSession, pack_id: int) -> Pack:
    """Fresh pack with its contents, for responses after a change."""
    pack = await session.scalar(
        select(Pack)
        .where(Pack.id == pack_id)
        .options(PACK_CONTENTS)
        .execution_options(populate_existing=True)
    )
    if pack is None:
        raise HTTPException(404, "Pack not found")
    return pack


async def _priced_items(
    session: AsyncSession, items: list[PackItemIn], price: Decimal
) -> list[PackItem]:
    """The pack's rows, after checking every size exists and the pack saves money."""
    rows = await session.scalars(
        select(ProductVariant).where(ProductVariant.id.in_([i.variant_id for i in items]))
    )
    prices = {v.id: v.price for v in rows}
    missing = [i.variant_id for i in items if i.variant_id not in prices]
    if missing:
        raise HTTPException(422, f"Unknown size: {missing[0]}")
    regular = sum((prices[i.variant_id] * i.quantity for i in items), Decimal("0.000"))
    if price >= regular:
        raise HTTPException(
            422,
            f"A pack must cost less than its items bought separately ({regular:.3f})",
        )
    return [PackItem(variant_id=i.variant_id, quantity=i.quantity) for i in items]


@router.get("/packs", response_model=list[PackAdminOut])
async def list_packs(session: Session):
    rows = await session.scalars(
        select(Pack).order_by(Pack.sort_order, Pack.name_en, Pack.id).options(PACK_CONTENTS)
    )
    return rows.all()


@router.get("/packs/{pack_id}", response_model=PackAdminOut)
async def get_pack(pack_id: int, session: Session):
    return await _get_pack(session, pack_id)


@router.post("/packs", response_model=PackAdminOut, status_code=201)
async def create_pack(data: PackIn, session: Session):
    items = await _priced_items(session, data.items, data.price)
    pack = Pack(**data.model_dump(exclude={"items"}), items=items)
    session.add(pack)
    await _commit_or_conflict(session)
    return await _pack_out(session, pack.id)


@router.patch("/packs/{pack_id}", response_model=PackAdminOut)
async def update_pack(pack_id: int, data: PackPatch, session: Session):
    pack = await _get_pack(session, pack_id)
    changes = data.model_dump(exclude_unset=True)
    for field in ("slug", "name_en", "name_fr", "price", "items"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    if "items" in changes or "price" in changes:
        items = data.items or [
            PackItemIn(variant_id=i.variant_id, quantity=i.quantity) for i in pack.items
        ]
        new_items = await _priced_items(session, items, changes.get("price", pack.price))
        if "items" in changes:
            pack.items.clear()
            await session.flush()  # free the (pack, size) pairs before re-adding them
            pack.items.extend(new_items)
    for field, value in changes.items():
        if field != "items":
            setattr(pack, field, value)
    await _commit_or_conflict(session)
    return await _pack_out(session, pack_id)


@router.delete("/packs/{pack_id}", status_code=204)
async def delete_pack(pack_id: int, session: Session):
    # Past orders keep the pack's name and contents as snapshots, so deleting is always safe.
    pack = await _get_pack(session, pack_id)
    image = pack.image_path
    await session.delete(pack)
    await session.commit()
    delete_image(image)


@router.post("/packs/{pack_id}/image", response_model=PackAdminOut)
async def upload_pack_image(pack_id: int, file: UploadFile, session: Session):
    pack = await _get_pack(session, pack_id)
    old = pack.image_path
    pack.image_path = await save_image(file, "packs")
    await session.commit()
    delete_image(old)
    return await _pack_out(session, pack_id)


@router.delete("/packs/{pack_id}/image", response_model=PackAdminOut)
async def delete_pack_image(pack_id: int, session: Session):
    pack = await _get_pack(session, pack_id)
    old = pack.image_path
    pack.image_path = None
    await session.commit()
    delete_image(old)
    return await _pack_out(session, pack_id)
