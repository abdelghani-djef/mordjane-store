import asyncio
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import Order, ProductVariant
from tests.conftest import order_payload


async def _stock(session, variant_id: int) -> int:
    return await session.scalar(
        select(ProductVariant.stock)
        .where(ProductVariant.id == variant_id)
        .execution_options(populate_existing=True)
    )


def _pack(catalog, **overrides) -> dict:
    """Breakfast duo: 2 × dark (9.500) + 1 × almonds (14.500) = 33.500, sold for 29.900."""
    body = {
        "slug": "breakfast-duo",
        "name_en": "Breakfast duo",
        "name_fr": "Duo petit-déjeuner",
        "name_ar": "ثنائي الفطور",
        "price": "29.900",
        "is_featured": True,
        "items": [
            {"variant_id": catalog["dark"].id, "quantity": 2},
            {"variant_id": catalog["almonds"].id, "quantity": 1},
        ],
    }
    body.update(overrides)
    return body


async def _create(admin_client, catalog, **overrides) -> dict:
    r = await admin_client.post("/api/admin/packs", json=_pack(catalog, **overrides))
    assert r.status_code == 201, r.text
    return r.json()


def _pack_line(pack_id: int, qty: int) -> dict:
    return {"pack_id": pack_id, "quantity": qty}


async def _order(client, *items: dict, **overrides):
    payload = order_payload(**overrides)
    payload["items"] = list(items)
    return await client.post("/api/orders", json=payload)


async def test_admin_creates_pack_and_shop_shows_both_prices(client, admin_client, catalog):
    pack = await _create(admin_client, catalog)
    assert Decimal(pack["regular_price"]) == Decimal("33.500")
    assert pack["boxes_left"] == 5  # almonds: 5 in stock, 1 per box
    assert pack["problem"] is None

    [listed] = (await client.get("/api/packs")).json()
    assert listed["slug"] == "breakfast-duo" and listed["in_stock"] is True
    assert Decimal(listed["price"]) == Decimal("29.900")
    assert Decimal(listed["regular_price"]) == Decimal("33.500")
    assert "is_available" not in listed and "problem" not in listed
    assert [
        (i["product"]["slug"], i["variant"]["weight_grams"], i["quantity"]) for i in listed["items"]
    ] == [("dark-chocolate", 100, 2), ("roasted-almonds", 250, 1)]

    detail = await client.get("/api/packs/breakfast-duo")
    assert detail.status_code == 200 and detail.json()["name_ar"] == "ثنائي الفطور"
    assert [p["slug"] for p in (await client.get("/api/packs?featured=true")).json()] == [
        "breakfast-duo"
    ]
    assert (await client.get("/api/packs?featured=false")).json() == []


@pytest.mark.parametrize(
    "change",
    [
        {"items": [{"variant_id": "dark", "quantity": 1}]},  # a single item is no pack
        {"items": [{"variant_id": "dark", "quantity": 1}, {"variant_id": "dark", "quantity": 1}]},
        {"items": [{"variant_id": 9999, "quantity": 2}]},
        {"price": "33.500"},  # must cost less than the items bought separately
        {"slug": "Not A Slug"},
    ],
)
async def test_pack_validation(admin_client, catalog, change):
    for item in change.get("items", []):
        if item["variant_id"] == "dark":
            item["variant_id"] = catalog["dark"].id
    r = await admin_client.post("/api/admin/packs", json=_pack(catalog, **change))
    assert r.status_code == 422, r.text


async def test_duplicate_slug_conflicts(admin_client, catalog):
    await _create(admin_client, catalog)
    r = await admin_client.post("/api/admin/packs", json=_pack(catalog))
    assert r.status_code == 409


async def test_editing_contents_rechecks_the_saving(admin_client, catalog):
    pack = await _create(admin_client, catalog)
    url = f"/api/admin/packs/{pack['id']}"
    assert (await admin_client.patch(url, json={"price": "40.000"})).status_code == 422
    # 3 × dark = 28.500 is less than the current 29.900 price.
    r = await admin_client.patch(
        url, json={"items": [{"variant_id": catalog["dark"].id, "quantity": 3}]}
    )
    assert r.status_code == 422

    r = await admin_client.patch(
        url,
        json={
            "items": [
                {"variant_id": catalog["dark"].id, "quantity": 2},
                {"variant_id": catalog["dark_bulk"].id, "quantity": 1},
            ],
            "name_en": "Big duo",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name_en"] == "Big duo"
    assert Decimal(body["regular_price"]) == Decimal("88.000")
    assert [i["variant"]["id"] for i in body["items"]] == [
        catalog["dark"].id,
        catalog["dark_bulk"].id,
    ]


async def test_switched_off_and_sold_out_packs(client, admin_client, catalog):
    duo = await _create(admin_client, catalog)
    # milk has 1 unit: a box needs 2, so the pack is listed but sold out.
    await _create(
        admin_client,
        catalog,
        slug="milk-pair",
        price="14.000",
        is_featured=False,
        items=[{"variant_id": catalog["milk"].id, "quantity": 2}],
    )
    # walnuts are switched off: nobody can buy this box.
    off = await _create(
        admin_client,
        catalog,
        slug="with-walnuts",
        price="20.000",
        is_featured=False,
        items=[
            {"variant_id": catalog["off"].id, "quantity": 1},
            {"variant_id": catalog["dark"].id, "quantity": 1},
        ],
    )
    listed = {p["slug"]: p for p in (await client.get("/api/packs")).json()}
    assert listed["milk-pair"]["in_stock"] is False and listed["milk-pair"]["boxes_left"] == 0
    assert listed["with-walnuts"]["in_stock"] is False

    admin = {p["slug"]: p["problem"] for p in (await admin_client.get("/api/admin/packs")).json()}
    assert admin == {
        "breakfast-duo": None,
        "milk-pair": "out_of_stock",
        "with-walnuts": "item_unavailable",
    }

    await admin_client.patch(f"/api/admin/packs/{duo['id']}", json={"is_available": False})
    assert "breakfast-duo" not in {p["slug"] for p in (await client.get("/api/packs")).json()}
    assert (await client.get("/api/packs/breakfast-duo")).status_code == 404

    r = await _order(client, _pack_line(duo["id"], 1), _pack_line(off["id"], 1))
    assert r.status_code == 409
    assert r.json()["problems"] == [
        {"variant_id": None, "pack_id": duo["id"], "reason": "unavailable", "available": 0},
        {"variant_id": None, "pack_id": off["id"], "reason": "unavailable", "available": 0},
    ]


async def test_ordering_a_pack_takes_each_item_from_stock(client, session, admin_client, catalog):
    pack = await _create(admin_client, catalog)
    r = await _order(
        client, _pack_line(pack["id"], 2), {"variant_id": catalog["milk"].id, "quantity": 1}
    )
    assert r.status_code == 201, r.text
    # 2 × 29.900 + 7.250 + 7.000 delivery
    assert Decimal(r.json()["total"]) == Decimal("74.050")
    assert await _stock(session, catalog["dark"].id) == 6  # 10 - 2 boxes × 2
    assert await _stock(session, catalog["almonds"].id) == 3
    assert await _stock(session, catalog["milk"].id) == 0

    track = await client.get(
        "/api/orders/track", params={"code": r.json()["code"], "phone": "+21620123456"}
    )
    box, milk = track.json()["items"]
    assert box["pack_id"] == pack["id"] and box["variant_id"] is None
    assert box["product_name_fr"] == "Duo petit-déjeuner" and box["weight_grams"] is None
    assert Decimal(box["unit_price"]) == Decimal("29.900") and box["quantity"] == 2
    assert Decimal(box["line_total"]) == Decimal("59.800")
    assert [(p["product_name_fr"], p["weight_grams"], p["quantity"]) for p in box["parts"]] == [
        ("FR dark-chocolate", 100, 2),
        ("FR roasted-almonds", 250, 1),
    ]
    assert milk["parts"] == [] and milk["pack_id"] is None

    # Deleting or editing the pack later never rewrites the order.
    await admin_client.delete(f"/api/admin/packs/{pack['id']}")
    track = await client.get(
        "/api/orders/track", params={"code": r.json()["code"], "phone": "+21620123456"}
    )
    box = track.json()["items"][0]
    assert box["pack_id"] is None and len(box["parts"]) == 2


async def test_pack_and_loose_lines_share_stock(client, session, admin_client, catalog):
    pack = await _create(admin_client, catalog)
    almonds = catalog["almonds"]  # 5 in stock: 3 boxes take 3, so 3 loose ones are too many
    r = await _order(client, _pack_line(pack["id"], 3), {"variant_id": almonds.id, "quantity": 3})
    assert r.status_code == 409
    assert r.json()["problems"] == [
        {"variant_id": almonds.id, "pack_id": None, "reason": "insufficient_stock", "available": 5},
        {"variant_id": None, "pack_id": pack["id"], "reason": "insufficient_stock", "available": 5},
    ]
    assert await _stock(session, almonds.id) == 5
    assert await _stock(session, catalog["dark"].id) == 10
    assert await session.scalar(select(Order.id)) is None

    r = await _order(client, _pack_line(9999, 1))
    assert r.json()["problems"] == [
        {"variant_id": None, "pack_id": 9999, "reason": "not_found", "available": 0}
    ]


async def test_order_lines_name_a_size_or_a_pack(client, catalog):
    bad = [
        [{"quantity": 1}],
        [{"variant_id": catalog["dark"].id, "pack_id": 1, "quantity": 1}],
        [{"pack_id": 1, "quantity": 1}, {"pack_id": 1, "quantity": 2}],
    ]
    for items in bad:
        assert (await _order(client, *items)).status_code == 422


async def test_concurrent_orders_for_the_last_box_only_one_wins(
    client, session, admin_client, catalog
):
    # milk has 1 unit, so only one box can be made.
    pack = await _create(
        admin_client,
        catalog,
        price="15.000",
        items=[
            {"variant_id": catalog["milk"].id, "quantity": 1},
            {"variant_id": catalog["dark"].id, "quantity": 1},
        ],
    )
    responses = await asyncio.gather(*[_order(client, _pack_line(pack["id"], 1)) for _ in range(5)])
    assert sorted(r.status_code for r in responses) == [201, 409, 409, 409, 409]
    assert await _stock(session, catalog["milk"].id) == 0
    assert await _stock(session, catalog["dark"].id) == 9


async def test_cancelling_puts_the_items_back(client, session, admin_client, catalog):
    pack = await _create(admin_client, catalog)
    r = await _order(client, _pack_line(pack["id"], 2))
    order_id = (await admin_client.get("/api/admin/orders", params={"q": r.json()["code"]})).json()[
        "items"
    ][0]["id"]
    detail = (await admin_client.get(f"/api/admin/orders/{order_id}")).json()
    assert len(detail["items"][0]["parts"]) == 2  # staff see what goes in the box

    await admin_client.post(f"/api/admin/orders/{order_id}/status", json={"to_status": "cancelled"})
    assert await _stock(session, catalog["dark"].id) == 10
    assert await _stock(session, catalog["almonds"].id) == 5


async def test_emails_list_what_is_in_the_box(client, admin_client, catalog, outbox):
    pack = await _create(admin_client, catalog)
    await _order(client, _pack_line(pack["id"], 1))
    [mail] = [m for m in outbox if "amina@example.com" in m["to"]]
    assert "Duo petit-déjeuner" in mail["html"] and "Dans la boîte" in mail["html"]
    assert "2 × FR dark-chocolate, 100 g" in mail["html"]
    assert "1 × Duo petit-déjeuner: 29,900 DT" in mail["text"]
    assert "    2 × FR dark-chocolate, 100 g" in mail["text"]

    outbox.clear()
    await _order(client, _pack_line(pack["id"], 1), locale="ar")
    [mail] = [m for m in outbox if "amina@example.com" in m["to"]]
    assert "ثنائي الفطور" in mail["html"] and "في العلبة" in mail["html"]
    assert "شوكولاتة داكنة" in mail["html"]


async def test_low_stock_alert_through_a_pack(client, admin_client, catalog, outbox, staff_inboxes):
    pack = await _create(admin_client, catalog)
    # dark 10 → 4 crosses the threshold (5); almonds 5 → 2 were already low.
    await _order(client, _pack_line(pack["id"], 3))
    [alert] = [m for m in outbox if m["subject"].startswith("Stock faible")]
    assert "FR dark-chocolate" in alert["html"] and "FR roasted-almonds" not in alert["html"]


async def test_sizes_in_a_pack_cannot_be_deleted(admin_client, catalog):
    await _create(admin_client, catalog)
    r = await admin_client.delete(f"/api/admin/variants/{catalog['almonds'].id}")
    assert r.status_code == 409 and "Breakfast duo" in r.json()["detail"]
    r = await admin_client.delete(f"/api/admin/products/{catalog['products']['almonds'].id}")
    assert r.status_code == 409 and "Breakfast duo" in r.json()["detail"]

    await admin_client.post(
        "/api/admin/packs",
        json=_pack(
            catalog,
            slug="bulk-duo",
            name_en="Bulk duo",
            price="70.000",
            items=[
                {"variant_id": catalog["dark_bulk"].id, "quantity": 1},
                {"variant_id": catalog["milk"].id, "quantity": 1},
            ],
        ),
    )
    r = await admin_client.delete(f"/api/admin/variants/{catalog['dark_bulk'].id}")
    assert r.status_code == 409 and "Bulk duo" in r.json()["detail"]
