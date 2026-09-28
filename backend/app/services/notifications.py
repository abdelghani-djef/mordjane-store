"""Which emails go out, to whom and when.

Routes call `dispatch(...)` after committing: the email work runs as its own task, detached from
the HTTP request (FastAPI BackgroundTasks can be held back several seconds when a proxy streams
the request body, e.g. the Next.js rewrite). Each task opens its own database session, and a
failing mail server is logged instead of breaking checkout or the admin panel. Admins choose
recipients and events on the Notifications page.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import SessionLocal
from app.emails import Rendered, lang_of, money, render, weight
from app.emails.strings import STRINGS
from app.mail import MailError, send_email
from app.models import (
    Delegation,
    DeliveryCity,
    NotificationSettings,
    Order,
    OrderStatus,
    ProductVariant,
)

log = logging.getLogger("mordjane.notifications")

# Which settings toggle controls the customer email for each status.
CUSTOMER_STATUS_TOGGLES: dict[OrderStatus, str] = {
    OrderStatus.validated: "notify_customer_validated",
    OrderStatus.shipped: "notify_customer_shipped",
    OrderStatus.delivered: "notify_customer_delivered",
    OrderStatus.cancelled: "notify_customer_cancelled",
}


_pending: set[asyncio.Task] = set()


def dispatch(job: Callable[..., Awaitable[None]], *args) -> None:
    """Start `job(*args)` now, in the background (keeps a reference until it finishes)."""
    task = asyncio.get_running_loop().create_task(_run(job, *args))
    _pending.add(task)
    task.add_done_callback(_pending.discard)


async def _run(job: Callable[..., Awaitable[None]], *args) -> None:
    try:
        await job(*args)
    except Exception:
        log.exception("Notification job %s%r failed", job.__name__, args)


async def drain(timeout: float | None = None) -> None:
    """Wait for in-flight notification jobs (tests; graceful shutdown)."""
    if _pending:
        await asyncio.wait(list(_pending), timeout=timeout)


async def get_notification_settings(session: AsyncSession) -> NotificationSettings:
    """The settings row, created with defaults the first time it's needed."""
    row = await session.get(NotificationSettings, 1)
    if row is None:
        row = NotificationSettings(
            id=1,
            admin_recipients=[],
            low_stock_threshold=get_settings().low_stock_threshold,
        )
        session.add(row)
        await session.flush()
    return row


async def deliver(to: list[str], email: Rendered) -> None:
    """Send, logging failures: a background email must never break the shop."""
    try:
        await send_email(to, email.subject, email.html, email.text)
    except MailError:
        log.exception("Email %r to %s failed", email.subject, to)


def _site(path: str) -> str:
    return get_settings().public_site_url.rstrip("/") + path


def _track_url(order: Order) -> str:
    query = urlencode({"code": order.code, "phone": order.phone})
    return _site(f"/{lang_of(order.locale)}/track?{query}")


async def _load_order(session: AsyncSession, order_id: int) -> Order | None:
    return await session.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.events))
    )


async def _city_name(session: AsyncSession, order: Order, lang: str) -> str:
    """The city as the customer saw it: the order snapshots the French name."""
    if lang == "ar" and order.delivery_city_id is not None:
        city = await session.get(DeliveryCity, order.delivery_city_id)
        if city is not None and city.name_ar:
            return city.name_ar
    return order.city


async def _delegation_name(session: AsyncSession, order: Order, lang: str) -> str:
    """The delegation in the customer's language (the order snapshots the French name)."""
    if lang != "fr" and order.delegation_id is not None:
        delegation = await session.get(Delegation, order.delegation_id)
        if delegation is not None:
            name = delegation.name_ar if lang == "ar" else delegation.name_en
            if name:
                return name
    return order.delegation


def _area(delegation: str, city: str, lang: str) -> str:
    """Where to deliver, e.g. "La Marsa, Tunis"; only the city on pre-delegation orders."""
    return STRINGS[lang]["list_sep"].join(part for part in (delegation, city) if part)


async def _customer_area(session: AsyncSession, order: Order, lang: str) -> dict[str, str]:
    """Template context for the delivery place, as the customer saw it."""
    city = await _city_name(session, order, lang)
    delegation = await _delegation_name(session, order, lang)
    return {"city_name": city, "area": _area(delegation, city, lang)}


def _status_name(status: str, lang: str) -> str:
    return STRINGS[lang][f"status_{status}"]


# --- events -------------------------------------------------------------------------------


async def order_placed(order_id: int) -> None:
    """Customer confirmation (with code and tracking link) and the staff "new order" email."""
    async with SessionLocal() as session:
        prefs = await get_notification_settings(session)
        order = await _load_order(session, order_id)
        if order is None:
            return

        if prefs.notify_customer_confirmation and order.email:
            lang = lang_of(order.locale)
            t = STRINGS[lang]
            await deliver(
                [order.email],
                render(
                    "customer_order",
                    lang,
                    t["confirm_subject"].format(code=order.code),
                    order=order,
                    intro=t["confirm_intro"].format(phone=order.phone),
                    show_code=True,
                    track_url=_track_url(order),
                    **await _customer_area(session, order, lang),
                ),
            )

        if prefs.notify_admin_new_order and prefs.admin_recipients:
            lang = lang_of(prefs.admin_language)
            t = STRINGS[lang]
            await deliver(
                list(prefs.admin_recipients),
                render(
                    "admin_order",
                    lang,
                    t["admin_new_subject"].format(
                        code=order.code, total=money(order.total, lang), city=order.city
                    ),
                    order=order,
                    intro=t["admin_new_intro"],
                    note=None,
                    admin_url=_site(f"/{lang}/admin/orders/{order.id}"),
                    area=_area(order.delegation, order.city, lang),
                ),
            )


async def status_changed(order_id: int) -> None:
    """After a status change: the customer (if that status is switched on) and staff."""
    async with SessionLocal() as session:
        prefs = await get_notification_settings(session)
        order = await _load_order(session, order_id)
        if order is None or not order.events:
            return
        event = order.events[-1]
        to_status = OrderStatus(event.to_status)
        from_status = OrderStatus(event.from_status) if event.from_status else None

        toggle = CUSTOMER_STATUS_TOGGLES.get(to_status)
        if toggle and getattr(prefs, toggle) and order.email:
            lang = lang_of(order.locale)
            t = STRINGS[lang]
            await deliver(
                [order.email],
                render(
                    "customer_order",
                    lang,
                    t[f"status_subject_{to_status.value}"].format(code=order.code),
                    order=order,
                    intro=t[f"status_intro_{to_status.value}"].format(
                        total=money(order.total, lang)
                    ),
                    show_code=False,
                    track_url=_track_url(order),
                    **await _customer_area(session, order, lang),
                ),
            )

        if prefs.notify_admin_status_change and prefs.admin_recipients:
            lang = lang_of(prefs.admin_language)
            t = STRINGS[lang]
            names = {
                "code": order.code,
                "from_status": _status_name(from_status.value, lang) if from_status else "—",
                "to_status": _status_name(to_status.value, lang),
            }
            await deliver(
                list(prefs.admin_recipients),
                render(
                    "admin_order",
                    lang,
                    t["admin_status_subject"].format(**names),
                    order=order,
                    intro=t["admin_status_intro"].format(**names),
                    note=event.note or None,
                    admin_url=_site(f"/{lang}/admin/orders/{order.id}"),
                    area=_area(order.delegation, order.city, lang),
                ),
            )


async def low_stock(variant_ids: list[int]) -> None:
    """Staff alert for sizes that just crossed the low-stock threshold."""
    async with SessionLocal() as session:
        prefs = await get_notification_settings(session)
        if not (prefs.notify_admin_low_stock and prefs.admin_recipients and variant_ids):
            return
        variants = await session.scalars(
            select(ProductVariant)
            .where(ProductVariant.id.in_(variant_ids))
            .options(selectinload(ProductVariant.product))
            .order_by(ProductVariant.stock, ProductVariant.id)
        )
        lang = lang_of(prefs.admin_language)
        t = STRINGS[lang]
        rows = [
            {
                "name": v.product.name_fr if lang == "fr" else v.product.name_en,
                "size": weight(v.weight_grams, lang),
                "stock": v.stock,
                "url": _site(f"/{lang}/admin/products/{v.product_id}"),
            }
            for v in variants
        ]
        if not rows:
            return
        threshold = prefs.low_stock_threshold
        await deliver(
            list(prefs.admin_recipients),
            render(
                "admin_low_stock",
                lang,
                t["admin_low_subject"].format(count=len(rows), threshold=threshold),
                rows=rows,
                threshold=threshold,
                products_url=_site(f"/{lang}/admin/products"),
            ),
        )


async def send_test(to: list[str], lang: str) -> None:
    """Send the test email now; raises MailError so the admin sees what went wrong."""
    lang = lang_of(lang)
    email = render("test", lang, STRINGS[lang]["test_subject"])
    await send_email(to, email.subject, email.html, email.text)


def crossed_low_stock(before: dict[int, int], after: dict[int, int], threshold: int) -> list[int]:
    """Sizes whose stock went from above the threshold to at/below it (alert once, not per sale)."""
    return [vid for vid, old in before.items() if old > threshold >= after.get(vid, old)]
