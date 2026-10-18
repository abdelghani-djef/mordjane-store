"""Order placement and status transitions — the store's business rules live here."""

import secrets
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Delegation,
    DeliveryCity,
    Order,
    OrderItem,
    OrderItemPart,
    OrderStatus,
    OrderStatusEvent,
    Pack,
    PackItem,
    ProductVariant,
)
from app.schemas.orders import OrderIn, StockProblem
from app.services.notifications import crossed_low_stock, get_notification_settings

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I

ALLOWED_TRANSITIONS: dict[OrderStatus, frozenset[OrderStatus]] = {
    OrderStatus.pending: frozenset({OrderStatus.validated, OrderStatus.cancelled}),
    OrderStatus.validated: frozenset({OrderStatus.shipped, OrderStatus.cancelled}),
    OrderStatus.shipped: frozenset({OrderStatus.delivered, OrderStatus.cancelled}),
    OrderStatus.delivered: frozenset(),
    OrderStatus.cancelled: frozenset(),
}

_STATUS_ORDER = list(OrderStatus)


def allowed_transitions(status: OrderStatus) -> list[OrderStatus]:
    return sorted(ALLOWED_TRANSITIONS[status], key=_STATUS_ORDER.index)


class OrderRejected(Exception):
    def __init__(self, problems: list[StockProblem]):
        super().__init__("order rejected")
        self.problems = problems


class UnknownDeliveryCity(Exception):
    """The chosen delivery city doesn't exist or isn't served any more."""


class UnknownDelegation(Exception):
    """The chosen delegation isn't an active delegation of the chosen city."""

    def __init__(self, city_name: str):
        super().__init__(f"no such delegation in {city_name}")
        self.city_name = city_name


class InvalidTransition(Exception):
    def __init__(self, current: OrderStatus, requested: OrderStatus):
        super().__init__(f"cannot move order from {current} to {requested}")
        self.current = current
        self.requested = requested


def generate_code() -> str:
    return "MJ-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


async def _unique_code(session: AsyncSession) -> str:
    while True:
        code = generate_code()
        if not await session.scalar(select(Order.id).where(Order.code == code)):
            return code


@dataclass
class PlacedOrder:
    order: Order
    # Sizes this order pushed to/below the low-stock threshold (for the staff alert).
    low_stock_variant_ids: list[int]


def _part(variant: ProductVariant, item: PackItem) -> OrderItemPart:
    product = variant.product
    return OrderItemPart(
        variant_id=variant.id,
        product_name=product.name_en,
        product_name_fr=product.name_fr,
        product_name_ar=product.name_ar,
        weight_grams=variant.weight_grams,
        quantity=item.quantity,
    )


async def place_order(session: AsyncSession, data: OrderIn) -> PlacedOrder:
    """Validate stock, recompute prices server-side, decrement stock and persist the order.

    A pack line takes its items from the sizes' stock. All the sizes' rows (loose and in
    packs) are locked (in id order, to avoid deadlocks) for the whole transaction so two
    customers can never both buy the last unit. The delivery fee comes from the chosen city;
    the delegation must be one of its active delegations.
    """
    city = await session.get(DeliveryCity, data.delivery_city_id)
    if city is None or not city.is_active:
        raise UnknownDeliveryCity()
    delegation = await session.get(Delegation, data.delegation_id)
    if delegation is None or not delegation.is_active or delegation.city_id != city.id:
        raise UnknownDelegation(city.name_en)

    loose = {line.variant_id: line.quantity for line in data.items if line.variant_id}
    boxes = {line.pack_id: line.quantity for line in data.items if line.pack_id}
    packs: dict[int, Pack] = {}
    if boxes:
        rows = await session.scalars(
            select(Pack).where(Pack.id.in_(boxes)).options(selectinload(Pack.items))
        )
        packs = {p.id: p for p in rows}

    # Units of each size the whole order takes: loose lines plus the items of every box.
    need = dict(loose)
    for pack_id, qty in boxes.items():
        for item in packs[pack_id].items if pack_id in packs else []:
            need[item.variant_id] = need.get(item.variant_id, 0) + item.quantity * qty

    rows = await session.scalars(
        select(ProductVariant)
        .where(ProductVariant.id.in_(need))
        .order_by(ProductVariant.id)
        .with_for_update()
        .options(selectinload(ProductVariant.product))
    )
    variants = {v.id: v for v in rows}

    def short(variant_id: int) -> bool:
        return variants[variant_id].stock < need[variant_id]

    problems: list[StockProblem] = []
    for variant_id in loose:
        variant = variants.get(variant_id)
        if variant is None:
            problems.append(StockProblem(variant_id=variant_id, reason="not_found"))
        elif not variant.sellable:
            problems.append(StockProblem(variant_id=variant_id, reason="unavailable"))
        elif short(variant_id):
            problems.append(
                StockProblem(
                    variant_id=variant_id, reason="insufficient_stock", available=variant.stock
                )
            )
    for pack_id in boxes:
        pack = packs.get(pack_id)
        if pack is None:
            problems.append(StockProblem(pack_id=pack_id, reason="not_found"))
        elif not pack.is_available or not all(
            i.variant_id in variants and variants[i.variant_id].sellable for i in pack.items
        ):
            problems.append(StockProblem(pack_id=pack_id, reason="unavailable"))
        elif any(short(i.variant_id) for i in pack.items):
            # How many boxes this line alone could still have.
            available = min(variants[i.variant_id].stock // i.quantity for i in pack.items)
            problems.append(
                StockProblem(pack_id=pack_id, reason="insufficient_stock", available=available)
            )
    if problems:
        await session.rollback()
        raise OrderRejected(problems)

    stock_before = {v.id: v.stock for v in variants.values()}
    for variant_id, qty in need.items():
        variants[variant_id].stock -= qty

    items: list[OrderItem] = []
    subtotal = Decimal("0.000")
    for line in data.items:
        if line.pack_id:
            pack = packs[line.pack_id]
            line_total = pack.price * line.quantity
            items.append(
                OrderItem(
                    pack_id=pack.id,
                    product_name=pack.name_en,
                    product_name_fr=pack.name_fr,
                    product_name_ar=pack.name_ar,
                    weight_grams=None,
                    unit_price=pack.price,
                    quantity=line.quantity,
                    line_total=line_total,
                    parts=[_part(variants[i.variant_id], i) for i in pack.items],
                )
            )
        else:
            variant = variants[line.variant_id]
            product = variant.product
            line_total = variant.price * line.quantity
            items.append(
                OrderItem(
                    product_id=product.id,
                    variant_id=variant.id,
                    product_name=product.name_en,
                    product_name_fr=product.name_fr,
                    product_name_ar=product.name_ar,
                    weight_grams=variant.weight_grams,
                    unit_price=variant.price,
                    quantity=line.quantity,
                    line_total=line_total,
                )
            )
        subtotal += line_total

    delivery_fee = city.fee
    order = Order(
        code=await _unique_code(session),
        status=OrderStatus.pending,
        customer_name=data.customer_name.strip(),
        phone=data.phone,
        email=data.email,
        locale=data.locale,
        address=data.address.strip(),
        delivery_city_id=city.id,
        city=city.name_fr,
        delegation_id=delegation.id,
        delegation=delegation.name_fr,
        notes=data.notes.strip(),
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total=subtotal + delivery_fee,
        items=items,
        events=[OrderStatusEvent(from_status=None, to_status=OrderStatus.pending)],
    )
    session.add(order)
    prefs = await get_notification_settings(session)
    low = crossed_low_stock(
        stock_before, {v.id: v.stock for v in variants.values()}, prefs.low_stock_threshold
    )
    await session.commit()
    return PlacedOrder(order=order, low_stock_variant_ids=low)


async def change_status(
    session: AsyncSession,
    order_id: int,
    to_status: OrderStatus,
    *,
    note: str = "",
    admin_id: int | None = None,
) -> Order | None:
    """Move an order along its lifecycle. Cancelling puts the reserved stock back."""
    order = await session.scalar(
        select(Order)
        .where(Order.id == order_id)
        .with_for_update()
        .options(selectinload(Order.items).selectinload(OrderItem.parts))
    )
    if order is None:
        return None

    current = order.status
    if to_status not in ALLOWED_TRANSITIONS[current]:
        await session.rollback()
        raise InvalidTransition(current, to_status)

    if to_status is OrderStatus.cancelled:
        restock: dict[int, int] = {}
        for item in order.items:
            if item.variant_id is not None:
                restock[item.variant_id] = restock.get(item.variant_id, 0) + item.quantity
            for part in item.parts:
                if part.variant_id is not None:
                    units = part.quantity * item.quantity
                    restock[part.variant_id] = restock.get(part.variant_id, 0) + units
        if restock:
            rows = await session.scalars(
                select(ProductVariant)
                .where(ProductVariant.id.in_(restock))
                .order_by(ProductVariant.id)
                .with_for_update()
            )
            for variant in rows:
                variant.stock += restock[variant.id]

    order.status = to_status
    session.add(
        OrderStatusEvent(
            order_id=order.id,
            from_status=current,
            to_status=to_status,
            note=note.strip(),
            admin_id=admin_id,
        )
    )
    await session.commit()
    return order
