from sqlalchemy import func, select

from app.cli import _seed
from app.db import SessionLocal
from app.demo import load_demo
from app.models import AdminUser, Order, ProductVariant
from app.security import verify_password
from app.services.notifications import get_notification_settings


async def test_demo_loads_admin_settings_and_stock_once_without_orders():
    await _seed(force=False)
    async with SessionLocal() as session:
        assert await load_demo(session) == {"admins": 1, "stock": 5}

    async with SessionLocal() as session:
        assert await session.scalar(select(func.count()).select_from(Order)) == 0
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
        assert await session.scalar(select(func.count()).select_from(AdminUser)) == 1
