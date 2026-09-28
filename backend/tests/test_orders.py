import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.models import Order, OrderStatus, ProductVariant
from tests.conftest import order_payload


async def _stock(session, variant_id: int) -> int:
    return await session.scalar(
        select(ProductVariant.stock)
        .where(ProductVariant.id == variant_id)
        .execution_options(populate_existing=True)
    )


async def test_place_order_recomputes_prices_and_decrements_stock(client, session, catalog):
    dark, almonds = catalog["dark"], catalog["almonds"]
    payload = order_payload((dark.id, 2), (almonds.id, 1))
    # Client-supplied prices must be ignored.
    payload["items"][0]["price"] = "0.01"

    r = await client.post("/api/orders", json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["code"].startswith("MJ-") and len(body["code"]) == 9
    # 2 x 9.500 + 14.500 + 7.000 delivery to Tunis
    assert Decimal(body["total"]) == Decimal("40.500")

    assert await _stock(session, dark.id) == 8
    assert await _stock(session, almonds.id) == 4

    order = await session.scalar(select(Order).where(Order.code == body["code"]))
    assert order.status is OrderStatus.pending
    assert order.phone == "+21620123456"  # normalised
    assert order.subtotal == Decimal("33.500")
    assert order.delivery_fee == Decimal("7.000")
    assert order.city == "Tunis" and order.delivery_city_id == catalog["cities"]["tunis"].id


async def test_oversell_is_rejected_without_touching_stock(client, session, catalog):
    dark, almonds = catalog["dark"], catalog["almonds"]
    r = await client.post("/api/orders", json=order_payload((dark.id, 1), (almonds.id, 6)))
    assert r.status_code == 409
    problems = r.json()["problems"]
    assert problems == [{"variant_id": almonds.id, "reason": "insufficient_stock", "available": 5}]
    assert await _stock(session, dark.id) == 10
    assert await session.scalar(select(Order.id)) is None


async def test_unavailable_sold_out_and_unknown_products_rejected(client, catalog):
    r = await client.post(
        "/api/orders",
        json=order_payload((catalog["off"].id, 1), (catalog["sold_out"].id, 1), (9999, 1)),
    )
    assert r.status_code == 409
    reasons = {p["variant_id"]: p["reason"] for p in r.json()["problems"]}
    assert reasons == {
        catalog["off"].id: "unavailable",
        catalog["sold_out"].id: "insufficient_stock",
        9999: "not_found",
    }


async def test_concurrent_orders_for_last_unit_only_one_wins(client, session, catalog):
    milk = catalog["milk"]  # stock = 1
    responses = await asyncio.gather(
        *[client.post("/api/orders", json=order_payload((milk.id, 1))) for _ in range(5)]
    )
    statuses = sorted(r.status_code for r in responses)
    assert statuses == [201, 409, 409, 409, 409]
    assert await _stock(session, milk.id) == 0


async def test_order_validation(client, catalog):
    dark = catalog["dark"]
    bad = [
        order_payload(),  # no items
        order_payload((dark.id, 0)),
        order_payload((dark.id, 1), (dark.id, 2)),  # duplicate line
        order_payload((dark.id, 1), phone="not-a-phone"),
        order_payload((dark.id, 1), email="nope"),
    ]
    for payload in bad:
        r = await client.post("/api/orders", json=payload)
        assert r.status_code == 422, payload


async def test_track_requires_matching_phone(client, catalog):
    r = await client.post("/api/orders", json=order_payload((catalog["dark"].id, 1)))
    code = r.json()["code"]

    ok = await client.get(
        "/api/orders/track", params={"code": code.lower(), "phone": "+21620123456"}
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "pending"
    assert body["items"][0]["product_name_fr"] == "FR dark-chocolate"
    assert [e["to_status"] for e in body["events"]] == ["pending"]
    # Personal details are not exposed on the public tracking endpoint.
    assert "customer_name" not in body and "address" not in body

    wrong = await client.get("/api/orders/track", params={"code": code, "phone": "+21699000000"})
    assert wrong.status_code == 404


async def test_delivery_fee_comes_from_chosen_city(client, catalog):
    sfax = catalog["cities"]["sfax"]
    r = await client.post(
        "/api/orders",
        json=order_payload(
            (catalog["milk"].id, 1),
            delivery_city_id=sfax.id,
            delegation_id=catalog["delegations"]["sfax_ville"].id,
        ),
    )
    assert r.status_code == 201, r.text
    # 7.250 + 8.500 — millimes are kept exactly
    assert Decimal(r.json()["total"]) == Decimal("15.750")


async def test_unknown_or_inactive_city_rejected_without_touching_stock(client, session, catalog):
    dark = catalog["dark"]
    for city_id in (catalog["cities"]["closed"].id, 9999):
        r = await client.post(
            "/api/orders", json=order_payload((dark.id, 1), delivery_city_id=city_id)
        )
        assert r.status_code == 422
    assert await _stock(session, dark.id) == 10


async def test_public_city_list_only_active_in_order(client, catalog):
    r = await client.get("/api/delivery-cities")
    assert r.status_code == 200
    body = r.json()
    assert [c["name_fr"] for c in body] == ["Tunis", "Sfax"]
    assert body[0]["fee"] == "7.000"


async def test_public_city_list_only_active_delegations(client, catalog):
    body = (await client.get("/api/delivery-cities")).json()
    names = {c["name_fr"]: [d["name_fr"] for d in c["delegations"]] for c in body}
    assert names == {"Tunis": ["La Marsa"], "Sfax": ["Sfax Ville"]}  # Carthage is switched off
    assert body[0]["delegations"][0] == {
        "id": catalog["delegations"]["la_marsa"].id,
        "name_en": "La Marsa",
        "name_fr": "La Marsa",
        "name_ar": "المرسى",
    }


async def test_delegation_is_required(client, catalog):
    payload = order_payload((catalog["dark"].id, 1))
    del payload["delegation_id"]
    assert (await client.post("/api/orders", json=payload)).status_code == 422


async def test_delegation_must_be_active_and_in_the_chosen_city(client, session, catalog):
    dark, delegations = catalog["dark"], catalog["delegations"]
    for delegation_id in (
        delegations["sfax_ville"].id,  # another governorate
        delegations["carthage"].id,  # switched off
        9999,
    ):
        r = await client.post(
            "/api/orders", json=order_payload((dark.id, 1), delegation_id=delegation_id)
        )
        assert r.status_code == 422, delegation_id
        assert r.json()["detail"] == "Choose a delegation in Tunis"
    assert await _stock(session, dark.id) == 10
    assert await session.scalar(select(Order.id)) is None


async def test_order_snapshots_the_delegation(client, session, catalog):
    r = await client.post("/api/orders", json=order_payload((catalog["dark"].id, 1)))
    assert r.status_code == 201, r.text
    order = await session.scalar(select(Order).where(Order.code == r.json()["code"]))
    assert order.delegation == "La Marsa"
    assert order.delegation_id == catalog["delegations"]["la_marsa"].id

    track = await client.get("/api/orders/track", params={"code": order.code, "phone": order.phone})
    assert track.json()["city"] == "Tunis" and track.json()["delegation"] == "La Marsa"


async def test_two_sizes_of_one_product_in_one_order(client, session, catalog):
    small, bulk = catalog["dark"], catalog["dark_bulk"]
    r = await client.post("/api/orders", json=order_payload((small.id, 1), (bulk.id, 2)))
    assert r.status_code == 201, r.text
    # 9.500 + 2 × 69.000 + 7.000
    assert Decimal(r.json()["total"]) == Decimal("154.500")
    assert await _stock(session, small.id) == 9
    assert await _stock(session, bulk.id) == 2

    track = await client.get(
        "/api/orders/track", params={"code": r.json()["code"], "phone": "+21620123456"}
    )
    assert {i["weight_grams"] for i in track.json()["items"]} == {100, 2500}


async def test_listing_shows_from_price_and_sorts_by_it(client, catalog):
    body = (await client.get("/api/products", params={"sort": "price_desc"})).json()
    dark = next(p for p in body["items"] if p["slug"] == "dark-chocolate")
    # "from" price is the cheapest size in stock
    assert dark["min_price"] == "9.500"
    assert len(dark["variants"]) == 2 and "stock" not in dark["variants"][0]
    prices = [float(p["min_price"]) for p in body["items"]]
    assert prices == sorted(prices, reverse=True)


async def test_order_snapshots_the_arabic_name_and_rejects_unknown_locales(client, catalog):
    bad = order_payload((catalog["dark"].id, 1), locale="de")
    assert (await client.post("/api/orders", json=bad)).status_code == 422

    r = await client.post(
        "/api/orders",
        json=order_payload((catalog["dark"].id, 1), (catalog["milk"].id, 1), locale="ar"),
    )
    assert r.status_code == 201, r.text
    track = await client.get(
        "/api/orders/track", params={"code": r.json()["code"], "phone": "+21620123456"}
    )
    names = {i["product_name_fr"]: i["product_name_ar"] for i in track.json()["items"]}
    assert names == {"FR dark-chocolate": "شوكولاتة داكنة", "FR milk-chocolate": None}
