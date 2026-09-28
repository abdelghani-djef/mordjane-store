from decimal import Decimal

from sqlalchemy import select

from app.mail import MailError
from app.models import Order
from tests.conftest import order_payload


def _to(outbox, address):
    return [m for m in outbox if address in m["to"]]


async def _place(client, *lines, **overrides):
    r = await client.post("/api/orders", json=order_payload(*lines, **overrides))
    assert r.status_code == 201, r.text
    return r.json()["code"]


async def _order_id(admin_client, code):
    r = await admin_client.get("/api/admin/orders", params={"q": code})
    return r.json()["items"][0]["id"]


async def test_checkout_requires_an_email(client, catalog):
    payload = order_payload((catalog["dark"].id, 1))
    del payload["email"]
    assert (await client.post("/api/orders", json=payload)).status_code == 422


async def test_customer_confirmation_has_code_items_and_tracking_link(client, catalog, outbox):
    code = await _place(client, (catalog["dark"].id, 2))
    [mail] = _to(outbox, "amina@example.com")
    assert mail["subject"] == f"Commande {code} reçue"  # French by default
    assert code in mail["html"] and "FR dark-chocolate" in mail["html"]
    assert "FR dark-chocolate, 100 g:" in mail["text"]
    assert "26,000 DT" in mail["text"]  # 2 × 9.500 + 7.000
    assert f"/fr/track?code={code}&phone=%2B21620123456" in mail["text"]
    assert f"/fr/track?code={code}&amp;phone=%2B21620123456" in mail["html"]  # escaped in HTML
    # Address, then the delegation with its governorate.
    assert "Bourguiba, La Marsa\nLa Marsa, Tunis\n" in mail["text"]
    assert "Bourguiba, La Marsa<br>La Marsa, Tunis<br>" in mail["html"]
    # No staff recipients configured yet → no staff email.
    assert len(outbox) == 1


async def test_customer_email_uses_the_shop_language(client, catalog, outbox):
    code = await _place(client, (catalog["dark"].id, 1), locale="en")
    [mail] = outbox
    assert mail["subject"] == f"Order {code} received"
    assert "16.500 DT" in mail["text"] and "/en/track?" in mail["text"]


async def test_staff_get_new_order_email(client, catalog, outbox, staff_inboxes):
    code = await _place(client, (catalog["dark"].id, 1))
    [staff] = [m for m in outbox if m["to"] == staff_inboxes]
    assert staff["subject"] == f"Nouvelle commande {code} : 16,500 DT, Tunis"
    assert "/fr/admin/orders/" in staff["html"] and "amina@example.com" in staff["html"]
    assert "La Marsa<br>La Marsa, Tunis<br>" in staff["html"]
    assert "livraison: 12 Avenue Habib Bourguiba, La Marsa / La Marsa, Tunis\n" in staff["text"]


async def test_status_emails_follow_the_switches(
    client, admin_client, catalog, outbox, staff_inboxes
):
    code = await _place(client, (catalog["dark"].id, 1))
    order_id = await _order_id(admin_client, code)
    outbox.clear()

    for status, note in (("validated", "called"), ("shipped", "Yalidine #123"), ("delivered", "")):
        r = await admin_client.post(
            f"/api/admin/orders/{order_id}/status", json={"to_status": status, "note": note}
        )
        assert r.status_code == 200

    customer = _to(outbox, "amina@example.com")
    # Defaults: customers hear about delivery (and cancellation), not every step.
    assert [m["subject"] for m in customer] == [f"Commande {code} livrée"]
    staff = [m for m in outbox if m["to"] == staff_inboxes]
    assert [m["subject"] for m in staff] == [
        f"Commande {code} : En attente → Validée",
        f"Commande {code} : Validée → Expédiée",
        f"Commande {code} : Expédiée → Livrée",
    ]
    assert "Yalidine #123" in staff[1]["html"]
    # Staff notes never reach the customer.
    assert "Yalidine" not in customer[0]["html"]


async def test_switches_turn_emails_off(client, admin_client, catalog, outbox, staff_inboxes):
    r = await admin_client.put(
        "/api/admin/notifications",
        json={
            "admin_recipients": staff_inboxes,
            "notify_admin_new_order": False,
            "notify_customer_confirmation": False,
            "notify_customer_shipped": True,
        },
    )
    assert r.status_code == 200
    code = await _place(client, (catalog["dark"].id, 1))
    assert outbox == []

    order_id = await _order_id(admin_client, code)
    for status in ("validated", "shipped"):
        await admin_client.post(f"/api/admin/orders/{order_id}/status", json={"to_status": status})
    assert [m["subject"] for m in _to(outbox, "amina@example.com")] == [f"Commande {code} expédiée"]


async def test_low_stock_alert_once_when_crossing(client, catalog, outbox, staff_inboxes):
    dark = catalog["dark"]  # stock 10, threshold 5
    await _place(client, (dark.id, 4))  # 10 → 6: still fine
    assert not [m for m in outbox if m["subject"].startswith("Stock faible")]

    await _place(client, (dark.id, 1))  # 6 → 5: crosses the threshold
    [alert] = [m for m in outbox if m["subject"].startswith("Stock faible")]
    assert alert["to"] == staff_inboxes
    assert "FR dark-chocolate" in alert["html"] and "100 g" in alert["html"]

    outbox.clear()
    await _place(client, (dark.id, 1))  # 5 → 4: already low, no repeat
    assert not [m for m in outbox if m["subject"].startswith("Stock faible")]


async def test_low_stock_threshold_is_configurable(
    client, admin_client, catalog, outbox, staff_inboxes
):
    await admin_client.put(
        "/api/admin/notifications",
        json={"admin_recipients": staff_inboxes, "low_stock_threshold": 9},
    )
    await _place(client, (catalog["dark"].id, 1))  # 10 → 9
    assert [m for m in outbox if m["subject"].startswith("Stock faible : 1 format(s) à 9")]
    stats = (await admin_client.get("/api/admin/stats")).json()
    assert stats["low_stock_threshold"] == 9


async def test_mail_failure_never_breaks_checkout(client, catalog, monkeypatch):
    async def broken(*args, **kwargs):
        raise MailError("SMTPConnectError: connection refused")

    monkeypatch.setattr("app.services.notifications.send_email", broken)
    r = await client.post("/api/orders", json=order_payload((catalog["dark"].id, 1)))
    assert r.status_code == 201


async def test_settings_api(client, admin_client):
    assert (await client.get("/api/admin/notifications")).status_code == 401

    defaults = (await admin_client.get("/api/admin/notifications")).json()
    assert defaults["admin_recipients"] == [] and defaults["low_stock_threshold"] == 5
    assert defaults["notify_customer_delivered"] is True
    assert defaults["mail_server"]["port"] > 0

    r = await admin_client.put(
        "/api/admin/notifications",
        json={"admin_recipients": [" Boss@Shop.tn ", "boss@shop.tn", "team@shop.local"]},
    )
    assert r.json()["admin_recipients"] == ["boss@shop.tn", "team@shop.local"]

    bad = await admin_client.put(
        "/api/admin/notifications", json={"admin_recipients": ["not-an-email"]}
    )
    assert bad.status_code == 422
    negative = await admin_client.put("/api/admin/notifications", json={"low_stock_threshold": -1})
    assert negative.status_code == 422


async def test_send_test_email(admin_client, outbox, monkeypatch):
    sent = []

    async def fake_test(to, lang):
        sent.append((to, lang))

    monkeypatch.setattr("app.services.notifications.send_test", fake_test)
    none_yet = await admin_client.post("/api/admin/notifications/test", json={})
    assert none_yet.status_code == 422

    r = await admin_client.post("/api/admin/notifications/test", json={"to": ["me@shop.tn"]})
    assert r.status_code == 200 and r.json()["sent_to"] == ["me@shop.tn"]
    assert sent == [(["me@shop.tn"], "fr")]

    async def failing(to, lang):
        raise MailError("SMTPConnectError: connection refused")

    monkeypatch.setattr("app.services.notifications.send_test", failing)
    r = await admin_client.post("/api/admin/notifications/test", json={"to": ["me@shop.tn"]})
    assert r.status_code == 502 and "connection refused" in r.json()["detail"]


def test_money_and_weight_formatting():
    from app.emails import money, weight

    assert money(Decimal("1234.5"), "fr") == "1 234,500 DT"
    assert money(Decimal("1234.5"), "en") == "1,234.500 DT"
    assert weight(2500, "fr") == "2,5 kg" and weight(2500, "en") == "2.5 kg"
    assert weight(200, "ar") == "200 غ" and weight(None, "en") == ""


def test_helo_hostname_defaults_to_sender_domain(monkeypatch):
    from app import mail
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "mail_from", "Mordjane <orders@mordjane.tn>")
    monkeypatch.setattr(get_settings(), "smtp_helo_hostname", None)
    assert mail.helo_hostname() == "mordjane.tn"
    monkeypatch.setattr(get_settings(), "smtp_helo_hostname", "mx.mordjane.tn")
    assert mail.helo_hostname() == "mx.mordjane.tn"


async def test_rendered_emails_contain_only_copy(
    client, admin_client, catalog, outbox, staff_inboxes
):
    """No template variable may resolve to a Python object (e.g. a dict method)."""
    code = await _place(client, (catalog["dark"].id, 1), locale="en")
    order_id = await _order_id(admin_client, code)
    await admin_client.post(f"/api/admin/orders/{order_id}/status", json={"to_status": "cancelled"})
    assert len(outbox) >= 4
    for mail in outbox:
        for body in (mail["html"], mail["text"]):
            assert "built-in method" not in body and " object at 0x" not in body
            assert "{" not in body.replace("{%", "")  # no unformatted placeholders
    confirmation = next(m for m in outbox if m["subject"] == f"Order {code} received")
    assert "Your order" in confirmation["html"]


async def test_arabic_customer_email_reads_right_to_left(client, catalog, outbox, staff_inboxes):
    code = await _place(client, (catalog["dark"].id, 1), (catalog["milk"].id, 1), locale="ar")
    [mail] = _to(outbox, "amina@example.com")
    assert mail["subject"] == f"تم استلام طلبك {code}"
    assert 'dir="rtl"' in mail["html"] and 'align="right"' in mail["html"]
    assert "شوكولاتة داكنة" in mail["text"]
    assert "FR milk-chocolate" in mail["text"]  # no Arabic name yet: French, not English
    assert "شوكولاتة داكنة، 100 غ" in mail["text"] and "23,750 د.ت" in mail["text"]
    assert "التوصيل (تونس)" in mail["text"] and f"/ar/track?code={code}" in mail["text"]
    # Staff keep their own language: Arabic is for customers only.
    [staff] = [m for m in outbox if m["to"] == staff_inboxes]
    assert staff["subject"].startswith(f"Nouvelle commande {code}")
    assert 'dir="ltr"' in staff["html"] and "/fr/admin/orders/" in staff["html"]


async def test_customer_emails_name_the_delegation_in_their_language(
    client, catalog, outbox, staff_inboxes
):
    await _place(client, (catalog["dark"].id, 1), locale="ar")
    await _place(
        client,
        (catalog["dark"].id, 1),
        locale="en",
        delivery_city_id=catalog["cities"]["sfax"].id,
        delegation_id=catalog["delegations"]["sfax_ville"].id,
    )
    arabic, english = _to(outbox, "amina@example.com")
    assert "\nالمرسى، تونس\n" in arabic["text"] and "<br>المرسى، تونس<br>" in arabic["html"]
    assert "\nSfax City, Sfax\n" in english["text"] and "<br>Sfax City, Sfax<br>" in english["html"]
    # Staff read the French snapshot.
    staff = [m for m in outbox if m["to"] == staff_inboxes]
    assert "<br>La Marsa, Tunis<br>" in staff[0]["html"]
    assert "La Marsa / La Marsa, Tunis\n" in staff[0]["text"]
    assert "<br>Sfax Ville, Sfax<br>" in staff[1]["html"]


async def test_orders_from_before_delegations_show_just_the_city(
    client, admin_client, session, catalog, outbox, staff_inboxes
):
    code = await _place(client, (catalog["dark"].id, 1))
    order = await session.scalar(select(Order).where(Order.code == code))
    order.delegation_id, order.delegation = None, ""
    await session.commit()
    outbox.clear()

    await admin_client.post(f"/api/admin/orders/{order.id}/status", json={"to_status": "cancelled"})
    [customer] = _to(outbox, "amina@example.com")
    assert "Bourguiba, La Marsa\nTunis\n" in customer["text"]
    assert "Bourguiba, La Marsa<br>Tunis<br>" in customer["html"]
    [staff] = [m for m in outbox if m["to"] == staff_inboxes]
    assert "Bourguiba, La Marsa / Tunis\n" in staff["text"]
