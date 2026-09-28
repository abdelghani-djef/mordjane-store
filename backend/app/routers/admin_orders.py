from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import Order, OrderItem, OrderStatus, Product, ProductVariant
from app.schemas.catalog import Page
from app.schemas.orders import (
    AdminStatsOut,
    LowStockOut,
    OrderAdminOut,
    OrderSummaryOut,
    StatusChangeIn,
)
from app.security import CurrentAdmin, require_admin
from app.services import notifications
from app.services.orders import InvalidTransition, allowed_transitions, change_status

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

Session = Annotated[AsyncSession, Depends(get_session)]


async def _load_order(session: AsyncSession, order_id: int) -> OrderAdminOut:
    # populate_existing: the identity map may still hold the pre-transition collections.
    order = await session.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.events))
        .execution_options(populate_existing=True)
    )
    if order is None:
        raise HTTPException(404, "Order not found")
    out = OrderAdminOut.model_validate(order)
    out.allowed_transitions = allowed_transitions(order.status)
    return out


@router.get("/orders", response_model=Page[OrderSummaryOut])
async def list_orders(
    session: Session,
    status_: Annotated[OrderStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    item_count = (
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .where(OrderItem.order_id == Order.id)
        .correlate(Order)
        .scalar_subquery()
    )
    stmt = select(Order, item_count.label("item_count"))
    if status_ is not None:
        stmt = stmt.where(Order.status == status_)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Order.code.ilike(pattern),
                Order.customer_name.ilike(pattern),
                Order.phone.ilike(pattern.replace(" ", "")),
                Order.city.ilike(pattern),
                Order.delegation.ilike(pattern),
            )
        )
    if date_from:
        stmt = stmt.where(Order.created_at >= datetime.combine(date_from, time.min, UTC))
    if date_to:
        stmt = stmt.where(
            Order.created_at < datetime.combine(date_to + timedelta(days=1), time.min, UTC)
        )

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await session.execute(
        stmt.order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for order, count in rows:
        summary = OrderSummaryOut.model_validate(order)
        summary.item_count = count
        items.append(summary)
    return Page(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/orders/{order_id}", response_model=OrderAdminOut)
async def get_order(order_id: int, session: Session):
    return await _load_order(session, order_id)


@router.post("/orders/{order_id}/status", response_model=OrderAdminOut)
async def set_order_status(
    order_id: int,
    data: StatusChangeIn,
    session: Session,
    admin: CurrentAdmin,
):
    try:
        order = await change_status(
            session, order_id, data.to_status, note=data.note, admin_id=admin.id
        )
    except InvalidTransition as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move an order from '{exc.current}' to '{exc.requested}'",
        ) from exc
    if order is None:
        raise HTTPException(404, "Order not found")
    notifications.dispatch(notifications.status_changed, order_id)
    return await _load_order(session, order_id)


@router.get("/stats", response_model=AdminStatsOut)
async def stats(session: Session):
    counts = dict(
        (await session.execute(select(Order.status, func.count()).group_by(Order.status))).all()
    )
    revenue = await session.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(Order.status == OrderStatus.delivered)
    )
    threshold = (await notifications.get_notification_settings(session)).low_stock_threshold
    low = await session.execute(
        select(ProductVariant, Product)
        .join(ProductVariant.product)
        .where(ProductVariant.stock <= threshold)
        .order_by(ProductVariant.stock, Product.name_en, ProductVariant.weight_grams)
        .limit(10)
    )
    return AdminStatsOut(
        orders_by_status={s: counts.get(s, 0) for s in OrderStatus},
        revenue_delivered=Decimal(revenue or 0),
        low_stock=[
            LowStockOut(
                variant_id=v.id,
                product_id=p.id,
                name_en=p.name_en,
                name_fr=p.name_fr,
                weight_grams=v.weight_grams,
                stock=v.stock,
                is_available=v.is_available and p.is_available,
            )
            for v, p in low
        ],
        low_stock_threshold=threshold,
    )
