"""Demo data: a demo admin, notification settings, a few stock tweaks and some packs, loaded
from the JSON files in demo_data/ on top of the seeded catalogue. It creates no orders.
"""

import json
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import AdminUser, Pack, PackItem, ProductVariant
from app.security import hash_password
from app.services.notifications import get_notification_settings

DEMO_DATA = Path(__file__).resolve().parent.parent / "demo_data"


def _load(name: str):
    return json.loads((DEMO_DATA / name).read_text(encoding="utf-8"))


class DemoDataError(Exception):
    """A demo file names a product size the database doesn't have."""


async def _variants(session) -> dict[tuple[str, int], ProductVariant]:
    rows = await session.scalars(
        select(ProductVariant).options(selectinload(ProductVariant.product))
    )
    return {(v.product.slug, v.weight_grams): v for v in rows}


def _variant(variants, slug: str, grams: int) -> ProductVariant:
    try:
        return variants[(slug, grams)]
    except KeyError:
        raise DemoDataError(f"no product size {slug} {grams} g; run seed first") from None


async def load_demo(session) -> dict[str, int] | None:
    """Load the demo files. Returns counts, or None if the demo admin is already there."""
    admins = _load("admins.json")
    emails = [entry["email"].lower() for entry in admins]
    if await session.scalar(select(AdminUser.id).where(AdminUser.email.in_(emails)).limit(1)):
        return None

    for entry in admins:
        session.add(
            AdminUser(email=entry["email"].lower(), password_hash=hash_password(entry["password"]))
        )

    prefs = await get_notification_settings(session)
    for field, value in _load("notification_settings.json").items():
        setattr(prefs, field, value)

    variants = await _variants(session)
    stock = _load("stock.json")
    for entry in stock:
        variant = _variant(variants, entry["product"], entry["grams"])
        variant.stock = entry["stock"]
        variant.is_available = entry.get("is_available", True)

    packs = _load("packs.json")
    for entry in packs:
        items = [
            PackItem(
                variant_id=_variant(variants, item["product"], item["grams"]).id,
                quantity=item["quantity"],
            )
            for item in entry.pop("items")
        ]
        session.add(Pack(**{**entry, "price": Decimal(entry["price"])}, items=items))

    await session.commit()
    return {"admins": len(admins), "stock": len(stock), "packs": len(packs)}
