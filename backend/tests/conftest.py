import os
import tempfile
from decimal import Decimal

# Point the app at the test database *before* anything imports app.config / app.db.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://mordjane:mordjane@127.0.0.1:5433/mordjane_test",
)
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="mordjane-media-")

import httpx  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    AdminUser,
    Base,
    Category,
    Delegation,
    DeliveryCity,
    Product,
    ProductVariant,
)
from app.security import hash_password  # noqa: E402
from app.services import notifications  # noqa: E402
from app.services.notifications import get_notification_settings  # noqa: E402

ADMIN_EMAIL = "admin@mordjane.test"
ADMIN_PASSWORD = "cocoa-and-hazelnut"


@pytest.fixture(scope="session", autouse=True)
async def _schema():
    assert "test" in str(engine.url.database), "refusing to run tests against a non-test DB"
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_tables():
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Capture outgoing email instead of talking to an SMTP server."""
    sent: list[dict] = []

    async def fake_send(to, subject, html, text):
        sent.append({"to": list(to), "subject": subject, "html": html, "text": text})

    monkeypatch.setattr("app.services.notifications.send_email", fake_send)
    return sent


@pytest.fixture
async def staff_inboxes(session):
    """Staff recipients configured on the Notifications page."""
    prefs = await get_notification_settings(session)
    prefs.admin_recipients = ["boss@shop.tn", "stock@shop.tn"]
    await session.commit()
    return prefs.admin_recipients


@pytest.fixture
async def session():
    async with SessionLocal() as s:
        yield s


async def _wait_for_emails(_response):
    # Emails are sent by detached tasks; let them finish so tests can assert on the outbox.
    await notifications.drain()


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        event_hooks={"response": [_wait_for_emails]},
    )


@pytest.fixture
async def client():
    async with _client() as c:
        yield c


@pytest.fixture
async def admin_client(session):
    session.add(AdminUser(email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD)))
    await session.commit()
    async with _client() as c:
        r = await c.post(
            "/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert r.status_code == 200, r.text
        yield c


@pytest.fixture
async def catalog(session):
    """Delivery cities, categories (one inactive) and products with known stock/prices (TND)."""
    tunis = DeliveryCity(
        name_en="Tunis", name_fr="Tunis", name_ar="تونس", fee=Decimal("7.000"), sort_order=1
    )
    sfax = DeliveryCity(name_en="Sfax", name_fr="Sfax", fee=Decimal("8.500"), sort_order=2)
    closed = DeliveryCity(
        name_en="Tataouine", name_fr="Tataouine", fee=Decimal("9.000"), is_active=False
    )
    session.add_all([tunis, sfax, closed])
    await session.flush()
    # order_payload() defaults to Tunis; tables are truncated with RESTART IDENTITY.
    assert tunis.id == DEFAULT_CITY_ID

    la_marsa = Delegation(
        city_id=tunis.id, name_en="La Marsa", name_fr="La Marsa", name_ar="المرسى"
    )
    carthage = Delegation(
        city_id=tunis.id, name_en="Carthage", name_fr="Carthage", name_ar="قرطاج", is_active=False
    )
    sfax_ville = Delegation(
        city_id=sfax.id, name_en="Sfax City", name_fr="Sfax Ville", name_ar="صفاقس المدينة"
    )
    session.add_all([la_marsa, carthage, sfax_ville])
    await session.flush()
    # ...and to its La Marsa delegation (Carthage is switched off).
    assert la_marsa.id == DEFAULT_DELEGATION_ID

    chocolates = Category(slug="chocolates", name_en="Chocolates", name_fr="Chocolats")
    nuts = Category(slug="nuts", name_en="Nuts", name_fr="Fruits secs", sort_order=1)
    hidden = Category(slug="hidden", name_en="Hidden", name_fr="Caché", is_active=False)
    session.add_all([chocolates, nuts, hidden])
    await session.flush()

    def product(cat, slug, price, stock, grams=100, **kw):
        """A product with one size; returns (product, variant)."""
        variant = ProductVariant(weight_grams=grams, price=Decimal(price), stock=stock)
        p = Product(
            category_id=cat.id,
            slug=slug,
            name_en=slug.replace("-", " ").title(),
            name_fr=f"FR {slug}",
            variants=[variant],
            **kw,
        )
        return p, variant

    made = {
        "dark": product(
            chocolates, "dark-chocolate", "9.500", 10, is_featured=True, name_ar="شوكولاتة داكنة"
        ),
        "milk": product(chocolates, "milk-chocolate", "7.250", 1),
        "almonds": product(nuts, "roasted-almonds", "14.500", 5, grams=250),
        "off": product(nuts, "walnuts-off", "16.000", 8, is_available=False),
        "sold_out": product(nuts, "sold-out-cashews", "19.500", 0),
        "in_hidden": product(hidden, "hidden-thing", "1.000", 3),
    }
    # A second, bulk size of the dark chocolate: bigger price, own stock.
    bulk = ProductVariant(weight_grams=2500, price=Decimal("69.000"), stock=4, sort_order=1)
    made["dark"][0].variants.append(bulk)
    session.add_all(p for p, _ in made.values())
    await session.commit()
    # catalog["dark"] etc. are the sellable sizes (what orders reference);
    # catalog["products"]["dark"] is the product itself.
    return {
        "cities": {"tunis": tunis, "sfax": sfax, "closed": closed},
        "delegations": {"la_marsa": la_marsa, "carthage": carthage, "sfax_ville": sfax_ville},
        "categories": {"chocolates": chocolates, "nuts": nuts, "hidden": hidden},
        "products": {k: p for k, (p, _) in made.items()},
        "dark_bulk": bulk,
        **{k: v for k, (_, v) in made.items()},
    }


DEFAULT_CITY_ID = 1
DEFAULT_DELEGATION_ID = 1


def order_payload(*lines: tuple[int, int], **overrides) -> dict:
    payload = {
        "customer_name": "Amina Ben Salah",
        "phone": "+216 20 123 456",
        "email": "amina@example.com",
        "address": "12 Avenue Habib Bourguiba, La Marsa",
        "delivery_city_id": DEFAULT_CITY_ID,
        "delegation_id": DEFAULT_DELEGATION_ID,
        "items": [{"variant_id": vid, "quantity": qty} for vid, qty in lines],
    }
    payload.update(overrides)
    return payload
