from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import Pack, PackItem, ProductVariant
from app.schemas.packs import PackOut

router = APIRouter(tags=["packs"])

Session = Annotated[AsyncSession, Depends(get_session)]

# Everything a pack's prices and stock are computed from.
PACK_CONTENTS = (
    selectinload(Pack.items).selectinload(PackItem.variant).selectinload(ProductVariant.product)
)


def _visible_packs():
    """Packs switched on by the admin. Sold-out ones stay listed (shown as sold out)."""
    return (
        select(Pack)
        .where(Pack.is_available.is_(True))
        .order_by(Pack.sort_order, Pack.name_en, Pack.id)
        .options(PACK_CONTENTS)
    )


@router.get("/packs", response_model=list[PackOut])
async def list_packs(session: Session, featured: bool | None = None):
    stmt = _visible_packs()
    if featured is not None:
        stmt = stmt.where(Pack.is_featured.is_(featured))
    rows = await session.scalars(stmt)
    return rows.all()


@router.get("/packs/{slug}", response_model=PackOut)
async def get_pack(slug: str, session: Session):
    pack = await session.scalar(_visible_packs().where(Pack.slug == slug))
    if pack is None:
        raise HTTPException(404, "Pack not found")
    return pack
