from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.cli import _seed
from app.db import SessionLocal
from app.demo import _load, load_demo
from app.models import AdminUser, Order, OrderStatus, ProductVariant
from app.security import verify_password
from app.services.notifications import get_notification_settings


async def test_demo_loads_consistent_orders_once():
    await _seed(force=False)
    async with SessionLocal() as session:
        loaded = await load_demo(session)
    assert loaded == {"orders": len(_load("orders.json")), "admins": 1, "stock": 5}

    async with SessionLocal() as session:
        orders = list(
            await session.scalars(
                select(Order).options(selectinload(Order.items), selectinload(Order.events))
            )
        )
        assert len(orders) == loaded["orders"]
        assert {o.status for o in orders} == set(OrderStatus)
        now = datetime.now(UTC)
        for order in orders:
            assert order.subtotal == sum(i.line_total for i in order.items)
            assert order.total == order.subtotal + order.delivery_fee
            events = sorted(order.events, key=lambda e: e.created_at)
            assert events[0].to_status is OrderStatus.pending
            assert events[-1].to_status is order.status
            assert order.created_at == events[0].created_at <= events[-1].created_at < now

        admin = await session.scalar(select(AdminUser))
        assert verify_password("demo-mordjane", admin.password_hash)
        prefs = await get_notification_settings(session)
        assert prefs.admin_recipients == ["orders@mordjane.local", "stock@mordjane.local"]
        white_glaze = await session.scalar(
            select(ProductVariant).where(
                ProductVariant.stock == 0, ProductVariant.weight_grams == 250
            )
        )
        assert white_glaze is not None

    # Running it again changes nothing.
    async with SessionLocal() as session:
        assert await load_demo(session) is None
        assert await session.scalar(select(func.count()).select_from(Order)) == loaded["orders"]
