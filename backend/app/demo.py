"""Demo data: orders with their status history, a demo admin, notification settings and a few
stock tweaks, loaded from the JSON files in demo_data/ on top of the seeded catalogue.

Order times are stored relative to now (`placed_hours_ago`), so the dashboard looks current
whenever the demo is loaded. Prices and delivery fees come from the catalogue in the database,
so totals always match it.
"""

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import (
    AdminUser,
    Delegation,
    DeliveryCity,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusEvent,
    Product,
    ProductVariant,
)
from app.security import hash_password
from app.services.notifications import get_notification_settings

DEMO_DATA = Path(__file__).resolve().parent.parent / "demo_data"


def _load(name: str):
    return json.loads((DEMO_DATA / name).read_text(encoding="utf-8"))


class DemoDataError(Exception):
    """A demo file names a product size, governorate or delegation the database doesn't have."""


async def _variants(session) -> dict[tuple[str, int], ProductVariant]:
    rows = await session.scalars(
        select(ProductVariant).options(selectinload(ProductVariant.product))
    )
    return {(v.product.slug, v.weight_grams): v for v in rows}


async def _places(session) -> dict[str, tuple[DeliveryCity, dict[str, Delegation]]]:
    cities = await session.scalars(
        select(DeliveryCity).options(selectinload(DeliveryCity.delegations))
    )
    return {c.name_fr: (c, {d.name_fr: d for d in c.delegations}) for c in cities}


async def _admins(session) -> list[AdminUser]:
    admins = []
    for entry in _load("admins.json"):
        email = entry["email"].lower()
        admin = await session.scalar(select(AdminUser).where(AdminUser.email == email))
        if admin is None:
            admin = AdminUser(email=email, password_hash=hash_password(entry["password"]))
            session.add(admin)
        admins.append(admin)
    await session.flush()
    return admins


async def _notification_settings(session) -> None:
    prefs = await get_notification_settings(session)
    for field, value in _load("notification_settings.json").items():
        setattr(prefs, field, value)


def _variant(variants, slug: str, grams: int) -> ProductVariant:
    try:
        return variants[(slug, grams)]
    except KeyError:
        raise DemoDataError(f"no product size {slug} {grams} g; run seed first") from None


def _order(entry: dict, variants, places, admin: AdminUser, now: datetime) -> Order:
    try:
        city, delegations = places[entry["governorate"]]
        delegation = delegations[entry["delegation"]]
    except KeyError:
        raise DemoDataError(
            f"unknown place {entry['governorate']} / {entry['delegation']}; run seed first"
        ) from None

    placed_at = now - timedelta(hours=entry["placed_hours_ago"])
    items: list[OrderItem] = []
    subtotal = Decimal("0.000")
    for line in entry["items"]:
        variant = _variant(variants, line["product"], line["grams"])
        product: Product = variant.product
        line_total = variant.price * line["quantity"]
        subtotal += line_total
        items.append(
            OrderItem(
                product_id=product.id,
                variant_id=variant.id,
                product_name=product.name_en,
                product_name_fr=product.name_fr,
                product_name_ar=product.name_ar,
                weight_grams=variant.weight_grams,
                unit_price=variant.price,
                quantity=line["quantity"],
                line_total=line_total,
            )
        )

    events = [
        OrderStatusEvent(from_status=None, to_status=OrderStatus.pending, created_at=placed_at)
    ]
    status = OrderStatus.pending
    for step in entry["history"]:
        to_status = OrderStatus(step["status"])
        at = placed_at + timedelta(hours=step["hours_after_placed"])
        events.append(
            OrderStatusEvent(
                from_status=status,
                to_status=to_status,
                note=step["note"],
                admin_id=admin.id,
                created_at=at,
            )
        )
        status = to_status

    return Order(
        code=entry["code"],
        status=status,
        customer_name=entry["customer_name"],
        phone=entry["phone"].replace(" ", ""),
        email=entry["email"],
        locale=entry["locale"],
        address=entry["address"],
        delivery_city_id=city.id,
        city=city.name_fr,
        delegation_id=delegation.id,
        delegation=delegation.name_fr,
        notes=entry["notes"],
        subtotal=subtotal,
        delivery_fee=city.fee,
        total=subtotal + city.fee,
        items=items,
        events=events,
        created_at=placed_at,
        updated_at=events[-1].created_at,
    )


async def load_demo(session) -> dict[str, int] | None:
    """Load the demo files. Returns counts, or None if the demo orders are already there."""
    orders = _load("orders.json")
    codes = [entry["code"] for entry in orders]
    if await session.scalar(select(Order.id).where(Order.code.in_(codes)).limit(1)):
        return None

    variants = await _variants(session)
    places = await _places(session)
    admins = await _admins(session)
    await _notification_settings(session)

    now = datetime.now(UTC)
    for entry in orders:
        order = _order(entry, variants, places, admins[0], now)
        session.add(order)
        # Like a real sale: what was sold leaves the shelf, unless the order was cancelled.
        if order.status is not OrderStatus.cancelled:
            for line in entry["items"]:
                variant = _variant(variants, line["product"], line["grams"])
                variant.stock = max(0, variant.stock - line["quantity"])

    stock = _load("stock.json")
    for entry in stock:
        variant = _variant(variants, entry["product"], entry["grams"])
        variant.stock = entry["stock"]
        variant.is_available = entry.get("is_available", True)

    await session.commit()
    return {"orders": len(orders), "admins": len(admins), "stock": len(stock)}
