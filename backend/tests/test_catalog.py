async def test_categories_only_active_in_sort_order(client, catalog):
    r = await client.get("/api/categories")
    assert r.status_code == 200
    assert [c["slug"] for c in r.json()] == ["chocolates", "nuts"]


async def test_products_hide_unavailable_and_inactive_category(client, catalog):
    r = await client.get("/api/products")
    body = r.json()
    slugs = {p["slug"] for p in body["items"]}
    assert slugs == {"dark-chocolate", "milk-chocolate", "roasted-almonds", "sold-out-cashews"}
    assert body["total"] == 4
    sold_out = next(p for p in body["items"] if p["slug"] == "sold-out-cashews")
    assert sold_out["in_stock"] is False
    # Exact stock and admin-only flags are not part of the public listing.
    assert "stock" not in sold_out and "is_available" not in sold_out


async def test_products_filter_search_featured_and_sort(client, catalog):
    r = await client.get("/api/products", params={"category": "nuts"})
    assert {p["slug"] for p in r.json()["items"]} == {"roasted-almonds", "sold-out-cashews"}

    r = await client.get("/api/products", params={"q": "FR milk"})
    assert [p["slug"] for p in r.json()["items"]] == ["milk-chocolate"]

    r = await client.get("/api/products", params={"featured": True})
    assert [p["slug"] for p in r.json()["items"]] == ["dark-chocolate"]

    r = await client.get("/api/products", params={"sort": "price_asc"})
    prices = [float(p["min_price"]) for p in r.json()["items"]]
    assert prices == sorted(prices)


async def test_products_pagination(client, catalog):
    r = await client.get("/api/products", params={"page_size": 3, "page": 2, "sort": "name"})
    body = r.json()
    assert body["total"] == 4 and body["page"] == 2 and len(body["items"]) == 1


async def test_product_detail(client, catalog):
    r = await client.get("/api/products/roasted-almonds")
    assert r.status_code == 200
    body = r.json()
    assert body["category"]["slug"] == "nuts"
    [size] = body["variants"]
    assert size["weight_grams"] == 250 and "packaging" not in size
    assert size["stock"] == 5 and size["in_stock"] is True
    assert body["image_url"] is None


async def test_product_detail_hidden_returns_404(client, catalog):
    assert (await client.get("/api/products/walnuts-off")).status_code == 404
    assert (await client.get("/api/products/hidden-thing")).status_code == 404
    assert (await client.get("/api/products/nope")).status_code == 404


async def test_arabic_names_are_public_and_searchable(client, catalog):
    r = await client.get("/api/products", params={"q": "داكنة"})
    [item] = r.json()["items"]
    assert item["slug"] == "dark-chocolate" and item["name_ar"] == "شوكولاتة داكنة"
    cities = (await client.get("/api/delivery-cities")).json()
    assert cities[0]["name_ar"] == "تونس"
