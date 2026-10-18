from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.cli import _seed, _seed_cities, _seed_delegations, _sync_catalog
from app.config import get_settings
from app.db import SessionLocal
from app.models import Category, Delegation, DeliveryCity, Pack, PackItem, Product, ProductVariant
from app.seed_catalog import PRODUCTS
from app.seed_delegations import DELEGATIONS


async def _products() -> dict[str, Product]:
    async with SessionLocal() as session:
        rows = await session.scalars(select(Product).options(selectinload(Product.variants)))
        return {p.slug: p for p in rows}


async def test_seed_loads_the_range_with_a_photo_per_size():
    await _seed(force=False)
    products = await _products()
    assert set(products) == {item.slug for item in PRODUCTS}

    rocher = products["creme-noisettes-rocher"]
    assert rocher.brand == "Cebon" and rocher.name_ar and rocher.ingredients_fr
    assert [v.weight_grams for v in rocher.variants] == [200, 600, 2500]
    for size in rocher.variants:
        assert size.image_path == f"products/creme-noisettes-rocher/{size.weight_grams}.webp"
        assert (get_settings().media_dir / size.image_path).exists()
    assert (get_settings().media_dir / rocher.image_path).exists()


async def test_seed_loads_the_offers_at_their_promotional_prices():
    await _seed(force=False)
    async with SessionLocal() as session:
        packs = (
            await session.scalars(
                select(Pack)
                .order_by(Pack.sort_order)
                .options(
                    selectinload(Pack.items)
                    .selectinload(PackItem.variant)
                    .selectinload(ProductVariant.product)
                )
            )
        ).all()
        # (offer price, "instead of") from the offers sheet.
        assert [(int(p.price), int(p.regular_price)) for p in packs] == [
            (75, 90), (94, 112), (87, 103), (92, 110), (104, 123), (84, 100),
            (97, 117), (57, 68), (56, 67), (53, 65), (51, 62), (50, 58),
        ]  # fmt: skip
        first = packs[0]
        assert (first.slug, first.name_fr, first.name_ar) == ("offre-1", "Offre 1", "العرض 1")
        assert [(i.variant.product.slug, i.variant.weight_grams) for i in first.items] == [
            ("creme-noisettes", 350),
            ("pate-a-tartiner", 350),
            ("creme-noisettes-rocher", 200),
            ("pate-a-tartiner-rocher", 200),
        ]
        assert [p.slug for p in packs if p.is_featured] == ["offre-1", "offre-8", "offre-12"]

    # Seeding again adds no duplicates.
    await _seed(force=True)
    async with SessionLocal() as session:
        assert len((await session.scalars(select(Pack.id))).all()) == 12


async def test_sync_keeps_prices_and_stock_and_switches_off_what_left_the_range(catalog):
    # An existing shop: one product that is in the range (with an extra, off-range size and
    # the shop's own price and stock) next to the fixture's products, which are not.
    async with SessionLocal() as session:
        nuts = await session.scalar(select(Category).where(Category.slug == "nuts"))
        session.add(
            Product(
                category_id=nuts.id,
                slug="creme-noisettes",
                name_en="Old name",
                name_fr="Ancien nom",
                variants=[
                    ProductVariant(weight_grams=200, price=Decimal("1.000"), stock=3),
                    ProductVariant(weight_grams=999, price=Decimal("2.000"), stock=5),
                ],
            )
        )
        await session.commit()

    await _sync_catalog()
    products = await _products()

    cream = products["creme-noisettes"]
    assert cream.name_fr == "Crème de noisettes" and cream.brand == "Cebon"
    sizes = {v.weight_grams: v for v in cream.variants}
    assert set(sizes) == {200, 350, 700, 2500, 12000, 999}
    assert sizes[200].price == Decimal("1.000") and sizes[200].stock == 3  # the shop's figures
    assert sizes[200].image_path == "products/creme-noisettes/200.webp"
    assert sizes[999].is_available is False  # not sold any more, kept for order history
    assert products["dark-chocolate"].is_available is False  # outside the range
    assert {item.slug for item in PRODUCTS} <= set(products)

    # Running it again changes nothing.
    await _sync_catalog()
    again = await _products()
    assert {v.weight_grams for v in again["creme-noisettes"].variants} == set(sizes)
    assert again["creme-noisettes"].image_path == cream.image_path


async def test_seed_cities_adds_every_delegation_once_and_keeps_edits():
    async with SessionLocal() as session:
        await _seed_cities(session)
        assert await _seed_delegations(session) == sum(map(len, DELEGATIONS.values())) == 279
        marsa = await session.scalar(select(Delegation).where(Delegation.name_fr == "La Marsa"))
        assert marsa.name_ar == "المرسى"
        assert (await session.get(DeliveryCity, marsa.city_id)).name_fr == "Tunis"
        marsa.name_en = "La Marsa (edited)"
        await session.commit()

        assert await _seed_delegations(session) == 0  # nothing added twice
        await session.refresh(marsa)
        assert marsa.name_en == "La Marsa (edited)"
