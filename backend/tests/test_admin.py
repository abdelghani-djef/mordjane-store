from decimal import Decimal

import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import ProductVariant
from tests.conftest import ADMIN_EMAIL, order_payload

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/admin/auth/me"),
        ("get", "/api/admin/orders"),
        ("get", "/api/admin/orders/1"),
        ("post", "/api/admin/orders/1/status"),
        ("get", "/api/admin/products"),
        ("post", "/api/admin/products"),
        ("patch", "/api/admin/products/1"),
        ("delete", "/api/admin/products/1"),
        ("post", "/api/admin/variants/1/image"),
        ("delete", "/api/admin/variants/1/image"),
        ("get", "/api/admin/categories"),
        ("post", "/api/admin/categories"),
        ("get", "/api/admin/stats"),
        ("get", "/api/admin/delivery-cities"),
        ("post", "/api/admin/delivery-cities"),
        ("patch", "/api/admin/delivery-cities/1"),
        ("delete", "/api/admin/delivery-cities/1"),
        ("post", "/api/admin/delivery-cities/1/delegations"),
        ("patch", "/api/admin/delegations/1"),
        ("delete", "/api/admin/delegations/1"),
    ],
)
async def test_admin_endpoints_require_auth(client, method, path):
    r = await getattr(client, method)(path)
    assert r.status_code == 401


async def test_login_rejects_bad_credentials_and_forged_cookie(client, admin_client):
    r = await client.post(
        "/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-password"}
    )
    assert r.status_code == 401
    client.cookies.set("mj_admin", "not.a.jwt")
    assert (await client.get("/api/admin/auth/me")).status_code == 401


async def test_login_me_logout(admin_client):
    me = await admin_client.get("/api/admin/auth/me")
    assert me.status_code == 200 and me.json()["email"] == ADMIN_EMAIL
    r = await admin_client.post("/api/admin/auth/logout")
    assert r.status_code == 204
    assert (await admin_client.get("/api/admin/auth/me")).status_code == 401


# --- order lifecycle ----------------------------------------------------------------------


async def _place(client, *lines):
    r = await client.post("/api/orders", json=order_payload(*lines))
    assert r.status_code == 201, r.text
    return r.json()["code"]


async def _order_id(admin_client, code):
    r = await admin_client.get("/api/admin/orders", params={"q": code})
    return r.json()["items"][0]["id"]


async def test_full_lifecycle_and_tracking_timeline(client, admin_client, catalog):
    code = await _place(client, (catalog["dark"].id, 3))
    order_id = await _order_id(admin_client, code)

    detail = (await admin_client.get(f"/api/admin/orders/{order_id}")).json()
    assert detail["customer_name"] == "Amina Ben Salah"
    assert detail["allowed_transitions"] == ["validated", "cancelled"]

    for status in ("validated", "shipped", "delivered"):
        r = await admin_client.post(
            f"/api/admin/orders/{order_id}/status", json={"to_status": status, "note": status}
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == status
    assert r.json()["allowed_transitions"] == []

    track = await client.get("/api/orders/track", params={"code": code, "phone": "+21620123456"})
    events = track.json()["events"]
    assert [e["to_status"] for e in events] == ["pending", "validated", "shipped", "delivered"]
    assert events[-1]["from_status"] == "shipped"


async def test_invalid_transitions_return_409(client, admin_client, catalog):
    order_id = await _order_id(admin_client, await _place(client, (catalog["dark"].id, 1)))

    r = await admin_client.post(
        f"/api/admin/orders/{order_id}/status", json={"to_status": "delivered"}
    )
    assert r.status_code == 409

    await admin_client.post(f"/api/admin/orders/{order_id}/status", json={"to_status": "cancelled"})
    r = await admin_client.post(
        f"/api/admin/orders/{order_id}/status", json={"to_status": "validated"}
    )
    assert r.status_code == 409

    r = await admin_client.post("/api/admin/orders/9999/status", json={"to_status": "validated"})
    assert r.status_code == 404


async def test_cancel_restores_stock(client, admin_client, session, catalog):
    almonds = catalog["almonds"]
    order_id = await _order_id(admin_client, await _place(client, (almonds.id, 4)))
    await admin_client.post(f"/api/admin/orders/{order_id}/status", json={"to_status": "validated"})
    r = await admin_client.post(
        f"/api/admin/orders/{order_id}/status",
        json={"to_status": "cancelled", "note": "customer unreachable"},
    )
    assert r.status_code == 200
    assert r.json()["events"][-1]["note"] == "customer unreachable"
    stock = await session.scalar(
        select(ProductVariant.stock)
        .where(ProductVariant.id == almonds.id)
        .execution_options(populate_existing=True)
    )
    assert stock == 5


async def test_order_list_filters_and_stats(client, admin_client, catalog):
    first = await _place(client, (catalog["dark"].id, 2))
    await _place(client, (catalog["almonds"].id, 1))
    first_id = await _order_id(admin_client, first)
    for status in ("validated", "shipped", "delivered"):
        await admin_client.post(f"/api/admin/orders/{first_id}/status", json={"to_status": status})

    pending = (await admin_client.get("/api/admin/orders", params={"status": "pending"})).json()
    assert pending["total"] == 1 and pending["items"][0]["item_count"] == 1

    stats = (await admin_client.get("/api/admin/stats")).json()
    assert stats["orders_by_status"]["pending"] == 1
    assert stats["orders_by_status"]["delivered"] == 1
    assert Decimal(stats["revenue_delivered"]) == Decimal("2") * Decimal("9.500") + Decimal("7.000")
    low = {p["name_en"] for p in stats["low_stock"]}
    assert "Milk Chocolate" in low and "Sold Out Cashews" in low


# --- catalog management -------------------------------------------------------------------


async def test_category_crud(admin_client, catalog):
    r = await admin_client.post(
        "/api/admin/categories",
        json={"slug": "gift-boxes", "name_en": "Gift Boxes", "name_fr": "Coffrets"},
    )
    assert r.status_code == 201
    cat_id = r.json()["id"]

    dup = await admin_client.post(
        "/api/admin/categories", json={"slug": "gift-boxes", "name_en": "x", "name_fr": "x"}
    )
    assert dup.status_code == 409

    bad_slug = await admin_client.post(
        "/api/admin/categories", json={"slug": "Gift Boxes!", "name_en": "x", "name_fr": "x"}
    )
    assert bad_slug.status_code == 422

    r = await admin_client.patch(f"/api/admin/categories/{cat_id}", json={"is_active": False})
    assert r.json()["is_active"] is False

    listing = (await admin_client.get("/api/admin/categories")).json()
    counts = {c["slug"]: c["product_count"] for c in listing}
    assert counts["chocolates"] == 2 and counts["gift-boxes"] == 0

    in_use = catalog["categories"]["chocolates"].id
    assert (await admin_client.delete(f"/api/admin/categories/{in_use}")).status_code == 409
    assert (await admin_client.delete(f"/api/admin/categories/{cat_id}")).status_code == 204


async def test_product_create_update_toggle(client, admin_client, catalog):
    nuts = catalog["categories"]["nuts"].id
    r = await admin_client.post(
        "/api/admin/products",
        json={
            "category_id": nuts,
            "slug": "hazelnut-cream",
            "name_en": "Hazelnut Cream",
            "name_fr": "Crème de noisettes",
            "brand": "Mordjane",
            "ingredients_en": "Sugar, hazelnuts",
            "shelf_life_months": 12,
            "variants": [
                {"weight_grams": 200, "price": "7.900", "stock": 7},
                {"weight_grams": 2500, "price": "72.000", "stock": 2},
            ],
        },
    )
    assert r.status_code == 201, r.text
    product = r.json()
    assert product["is_available"] is True and product["brand"] == "Mordjane"
    assert [v["weight_grams"] for v in product["variants"]] == [200, 2500]
    assert "packaging" not in product["variants"][0]

    detail = (await client.get("/api/products/hazelnut-cream")).json()
    assert detail["min_price"] == "7.900" and detail["shelf_life_months"] == 12
    assert [v["stock"] for v in detail["variants"]] == [7, 2]

    r = await admin_client.patch(
        f"/api/admin/products/{product['id']}", json={"is_available": False}
    )
    assert r.json()["is_available"] is False
    assert (await client.get("/api/products/hazelnut-cream")).status_code == 404

    r = await admin_client.patch(f"/api/admin/products/{product['id']}", json={"name_en": None})
    assert r.status_code == 422
    r = await admin_client.patch(f"/api/admin/products/{product['id']}", json={"category_id": 999})
    assert r.status_code == 422

    no_sizes = await admin_client.post(
        "/api/admin/products",
        json={"category_id": nuts, "slug": "x", "name_en": "x", "name_fr": "x", "variants": []},
    )
    assert no_sizes.status_code == 422
    same_weight = await admin_client.post(
        "/api/admin/products",
        json={
            "category_id": nuts,
            "slug": "twins",
            "name_en": "x",
            "name_fr": "x",
            "variants": [
                {"weight_grams": 200, "price": "1", "stock": 1},
                {"weight_grams": 200, "price": "2", "stock": 1},
            ],
        },
    )
    assert same_weight.status_code == 422

    listing = await admin_client.get("/api/admin/products", params={"available": False})
    assert {p["slug"] for p in listing.json()["items"]} == {"hazelnut-cream", "walnuts-off"}


async def test_sizes_add_edit_delete(client, admin_client, catalog):
    dark = catalog["products"]["dark"]
    r = await admin_client.post(
        f"/api/admin/products/{dark.id}/variants",
        json={"weight_grams": 600, "price": "22.500", "stock": 5},
    )
    assert r.status_code == 201, r.text
    sizes = {v["weight_grams"]: v for v in r.json()["variants"]}
    assert set(sizes) == {100, 600, 2500}

    # A size is its weight: a second 600 g size is refused.
    dup = await admin_client.post(
        f"/api/admin/products/{dark.id}/variants",
        json={"weight_grams": 600, "price": "1", "stock": 1},
    )
    assert dup.status_code == 409
    bad = await admin_client.post(
        f"/api/admin/products/{dark.id}/variants",
        json={"weight_grams": 0, "price": "1", "stock": 1},
    )
    assert bad.status_code == 422

    six_hundred = sizes[600]
    r = await admin_client.patch(
        f"/api/admin/variants/{six_hundred['id']}", json={"price": "21.000", "is_available": False}
    )
    resized = next(v for v in r.json()["variants"] if v["id"] == six_hundred["id"])
    assert resized["price"] == "21.000" and resized["is_available"] is False
    # Switched-off sizes are hidden from customers and can't be ordered.
    public = (await client.get("/api/products/dark-chocolate")).json()
    assert six_hundred["id"] not in {v["id"] for v in public["variants"]}
    r = await client.post("/api/orders", json=order_payload((six_hundred["id"], 1)))
    assert r.status_code == 409 and r.json()["problems"][0]["reason"] == "unavailable"

    assert (
        await admin_client.delete(f"/api/admin/variants/{six_hundred['id']}")
    ).status_code == 200

    # Sizes that were ordered can only be switched off; the last size can't be removed.
    await _place(client, (catalog["dark_bulk"].id, 1))
    r = await admin_client.delete(f"/api/admin/variants/{catalog['dark_bulk'].id}")
    assert r.status_code == 409
    only = catalog["almonds"]
    assert (await admin_client.delete(f"/api/admin/variants/{only.id}")).status_code == 409


async def test_product_delete_blocked_when_ordered(client, admin_client, catalog):
    await _place(client, (catalog["dark"].id, 1))
    r = await admin_client.delete(f"/api/admin/products/{catalog['products']['dark'].id}")
    assert r.status_code == 409
    r = await admin_client.delete(f"/api/admin/products/{catalog['products']['almonds'].id}")
    assert r.status_code == 204


async def test_product_image_upload(client, admin_client, catalog):
    pid = catalog["products"]["dark"].id
    r = await admin_client.post(
        f"/api/admin/products/{pid}/image",
        files={"file": ("dark.png", PNG_1PX, "image/png")},
    )
    assert r.status_code == 200, r.text
    url = r.json()["image_url"]
    assert url.startswith("/media/products/") and url.endswith(".png")
    served = await client.get(url)
    assert served.status_code == 200 and served.content == PNG_1PX

    fake = await admin_client.post(
        f"/api/admin/products/{pid}/image",
        files={"file": ("evil.png", b"<script>alert(1)</script>", "image/png")},
    )
    assert fake.status_code == 415


def _media_file(url):
    return get_settings().media_dir / url.removeprefix("/media/")


def _size(response, variant_id):
    return next(v for v in response.json()["variants"] if v["id"] == variant_id)


async def _upload_size_photo(admin_client, variant_id, content=PNG_1PX):
    return await admin_client.post(
        f"/api/admin/variants/{variant_id}/image",
        files={"file": ("size.png", content, "image/png")},
    )


async def test_size_photo_upload_replace_remove(client, admin_client, catalog):
    bulk = catalog["dark_bulk"]
    r = await _upload_size_photo(admin_client, bulk.id)
    assert r.status_code == 200, r.text
    first = _size(r, bulk.id)["image_url"]
    assert first.startswith("/media/products/") and _media_file(first).is_file()
    # Only that size gets the photo; the other size and the product keep theirs (none).
    assert _size(r, catalog["dark"].id)["image_url"] is None and r.json()["image_url"] is None

    public = await client.get("/api/products/dark-chocolate")
    assert _size(public, bulk.id)["image_url"] == first

    r = await _upload_size_photo(admin_client, bulk.id)
    second = _size(r, bulk.id)["image_url"]
    assert second != first and _media_file(second).is_file()
    assert not _media_file(first).exists()

    r = await admin_client.delete(f"/api/admin/variants/{bulk.id}/image")
    assert r.status_code == 200
    assert _size(r, bulk.id)["image_url"] is None and not _media_file(second).exists()


async def test_size_photo_rejects_bad_uploads(admin_client, catalog):
    fake = await _upload_size_photo(admin_client, catalog["dark"].id, b"<script>x</script>")
    assert fake.status_code == 415
    assert (await _upload_size_photo(admin_client, 9999)).status_code == 404
    assert (await admin_client.delete("/api/admin/variants/9999/image")).status_code == 404


async def test_deleting_size_or_product_removes_photos(admin_client, catalog):
    bulk = catalog["dark_bulk"]
    photo = _size(await _upload_size_photo(admin_client, bulk.id), bulk.id)["image_url"]
    assert (await admin_client.delete(f"/api/admin/variants/{bulk.id}")).status_code == 200
    assert not _media_file(photo).exists()

    almonds = catalog["products"]["almonds"]
    r = await admin_client.post(
        f"/api/admin/products/{almonds.id}/image",
        files={"file": ("almonds.png", PNG_1PX, "image/png")},
    )
    product_photo = r.json()["image_url"]
    size = catalog["almonds"].id
    size_photo = _size(await _upload_size_photo(admin_client, size), size)["image_url"]
    assert (await admin_client.delete(f"/api/admin/products/{almonds.id}")).status_code == 204
    assert not _media_file(product_photo).exists() and not _media_file(size_photo).exists()


# --- delivery cities ----------------------------------------------------------------------


async def test_delivery_city_crud_and_fee_change(client, admin_client, catalog):
    r = await admin_client.post(
        "/api/admin/delivery-cities",
        json={"name_en": "Djerba", "name_fr": "Djerba", "fee": "10.500", "sort_order": 30},
    )
    assert r.status_code == 201, r.text
    djerba = r.json()
    assert djerba["fee"] == "10.500" and djerba["order_count"] == 0

    dup = await admin_client.post(
        "/api/admin/delivery-cities", json={"name_en": "x", "name_fr": "Djerba", "fee": "1"}
    )
    assert dup.status_code == 409
    too_precise = await admin_client.post(
        "/api/admin/delivery-cities", json={"name_en": "y", "name_fr": "y", "fee": "1.2345"}
    )
    assert too_precise.status_code == 422

    # New fee applies to the next order; past orders keep their snapshot.
    tunis = catalog["cities"]["tunis"]
    first = await _place(client, (catalog["dark"].id, 1))
    r = await admin_client.patch(f"/api/admin/delivery-cities/{tunis.id}", json={"fee": "6.000"})
    assert r.json()["fee"] == "6.000"
    second = await _place(client, (catalog["dark"].id, 1))
    fees = {}
    for code in (first, second):
        detail = (
            await admin_client.get(f"/api/admin/orders/{await _order_id(admin_client, code)}")
        ).json()
        fees[code] = detail["delivery_fee"]
    assert fees == {first: "7.000", second: "6.000"}

    listing = (await admin_client.get("/api/admin/delivery-cities")).json()
    counts = {c["name_fr"]: c["order_count"] for c in listing}
    assert counts["Tunis"] == 2 and counts["Djerba"] == 0
    # Inactive cities stay visible to admins.
    assert "Tataouine" in counts

    assert (await admin_client.delete(f"/api/admin/delivery-cities/{tunis.id}")).status_code == 409
    # A city without orders goes, delegations included.
    r = await admin_client.post(
        f"/api/admin/delivery-cities/{djerba['id']}/delegations", json={"name_fr": "Houmt Souk"}
    )
    assert r.status_code == 201
    r = await admin_client.delete(f"/api/admin/delivery-cities/{djerba['id']}")
    assert r.status_code == 204


async def test_deactivated_city_disappears_from_checkout(client, admin_client, catalog):
    sfax = catalog["cities"]["sfax"]
    await admin_client.patch(f"/api/admin/delivery-cities/{sfax.id}", json={"is_active": False})
    names = [c["name_fr"] for c in (await client.get("/api/delivery-cities")).json()]
    assert names == ["Tunis"]
    r = await client.post(
        "/api/orders",
        json=order_payload(
            (catalog["dark"].id, 1),
            delivery_city_id=sfax.id,
            delegation_id=catalog["delegations"]["sfax_ville"].id,
        ),
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "We don't deliver to the selected city"


# --- delegations --------------------------------------------------------------------------


async def test_delegation_create(admin_client, catalog):
    tunis, sfax = catalog["cities"]["tunis"], catalog["cities"]["sfax"]
    url = f"/api/admin/delivery-cities/{tunis.id}/delegations"
    r = await admin_client.post(
        url, json={"name_fr": " Le Bardo ", "name_ar": "باردو", "sort_order": 3}
    )
    assert r.status_code == 201, r.text
    bardo = r.json()
    assert bardo == {
        "id": bardo["id"],
        "city_id": tunis.id,
        "name_fr": "Le Bardo",
        "name_en": "Le Bardo",  # defaults to the French name
        "name_ar": "باردو",
        "sort_order": 3,
        "is_active": True,
    }
    blank_en = await admin_client.post(url, json={"name_fr": "Le Kram", "name_en": " "})
    assert blank_en.status_code == 201 and blank_en.json()["name_en"] == "Le Kram"

    assert (await admin_client.post(url, json={"name_fr": "Le Bardo"})).status_code == 409
    assert (await admin_client.post(url, json={"name_fr": " "})).status_code == 422
    # The same name is fine in another governorate.
    r = await admin_client.post(
        f"/api/admin/delivery-cities/{sfax.id}/delegations", json={"name_fr": "Le Bardo"}
    )
    assert r.status_code == 201
    r = await admin_client.post(
        "/api/admin/delivery-cities/9999/delegations", json={"name_fr": "x"}
    )
    assert r.status_code == 404

    # Admins see every delegation, switched-off ones included.
    listing = (await admin_client.get("/api/admin/delivery-cities")).json()
    names = {c["name_fr"]: [d["name_fr"] for d in c["delegations"]] for c in listing}
    assert names["Tunis"] == ["Carthage", "La Marsa", "Le Kram", "Le Bardo"]
    assert names["Sfax"] == ["Le Bardo", "Sfax Ville"]


async def test_delegation_edit_and_delete(client, admin_client, catalog):
    la_marsa, carthage = catalog["delegations"]["la_marsa"], catalog["delegations"]["carthage"]
    edit = f"/api/admin/delegations/{carthage.id}"
    r = await admin_client.patch(edit, json={"name_en": "Carthage Hannibal", "is_active": True})
    assert r.status_code == 200, r.text
    assert r.json()["name_en"] == "Carthage Hannibal" and r.json()["is_active"] is True
    public = (await client.get("/api/delivery-cities")).json()
    assert [d["name_fr"] for d in public[0]["delegations"]] == ["Carthage", "La Marsa"]

    for body in ({"name_fr": None}, {"name_en": None}, {"name_fr": " "}, {"is_active": None}):
        assert (await admin_client.patch(edit, json=body)).status_code == 422, body
    assert (await admin_client.patch(edit, json={"name_fr": "La Marsa"})).status_code == 409
    r = await admin_client.patch("/api/admin/delegations/9999", json={"is_active": False})
    assert r.status_code == 404

    # Renaming never rewrites past orders; ordered delegations can only be switched off.
    order_id = await _order_id(admin_client, await _place(client, (catalog["dark"].id, 1)))
    r = await admin_client.patch(
        f"/api/admin/delegations/{la_marsa.id}", json={"name_fr": "La Marsa Plage"}
    )
    assert r.json()["name_fr"] == "La Marsa Plage"
    detail = (await admin_client.get(f"/api/admin/orders/{order_id}")).json()
    assert detail["delegation"] == "La Marsa"
    r = await admin_client.delete(f"/api/admin/delegations/{la_marsa.id}")
    assert r.status_code == 409
    assert r.json()["detail"] == "This delegation has orders; switch it off instead"

    assert (await admin_client.delete(edit)).status_code == 204
    assert (await admin_client.delete(edit)).status_code == 404


async def test_admin_order_list_and_detail_show_the_delegation(client, admin_client, catalog):
    await _place(client, (catalog["dark"].id, 1))  # La Marsa, Tunis
    r = await client.post(
        "/api/orders",
        json=order_payload(
            (catalog["dark"].id, 1),
            delivery_city_id=catalog["cities"]["sfax"].id,
            delegation_id=catalog["delegations"]["sfax_ville"].id,
        ),
    )
    code = r.json()["code"]

    listing = (await admin_client.get("/api/admin/orders", params={"q": "ville"})).json()
    [found] = listing["items"]
    assert found["code"] == code and found["delegation"] == "Sfax Ville"
    detail = (await admin_client.get(f"/api/admin/orders/{found['id']}")).json()
    assert detail["city"] == "Sfax" and detail["delegation"] == "Sfax Ville"


async def test_staff_notes_stay_private(client, admin_client, catalog):
    code = await _place(client, (catalog["dark"].id, 1))
    order_id = await _order_id(admin_client, code)
    r = await admin_client.post(
        f"/api/admin/orders/{order_id}/status",
        json={"to_status": "validated", "note": "customer sounded unsure, call twice"},
    )
    assert r.json()["events"][-1]["note"] == "customer sounded unsure, call twice"

    track = await client.get("/api/orders/track", params={"code": code, "phone": "+21620123456"})
    assert track.status_code == 200
    assert all("note" not in e for e in track.json()["events"])


async def test_stock_edit_refused_if_orders_changed_it(client, admin_client, catalog):
    dark = catalog["dark"]  # stock 10 when the admin loads the page
    await _place(client, (dark.id, 2))  # a sale lands meanwhile → 8

    def stock_of(response):
        return next(v["stock"] for v in response.json()["variants"] if v["id"] == dark.id)

    stale = await admin_client.patch(
        f"/api/admin/variants/{dark.id}", json={"stock": 30, "expected_stock": 10}
    )
    assert stale.status_code == 409
    assert "8" in stale.json()["detail"]

    fresh = await admin_client.patch(
        f"/api/admin/variants/{dark.id}", json={"stock": 30, "expected_stock": 8}
    )
    assert fresh.status_code == 200 and stock_of(fresh) == 30

    # Without expected_stock the edit is an explicit overwrite (e.g. after a physical count).
    blind = await admin_client.patch(f"/api/admin/variants/{dark.id}", json={"stock": 12})
    assert blind.status_code == 200 and stock_of(blind) == 12
