"""Management commands: `python -m app.cli create-admin` and `python -m app.cli seed`."""

import asyncio
import shutil
from decimal import Decimal
from pathlib import Path

import typer
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import SessionLocal, engine
from app.media import delete_image
from app.models import AdminUser, Category, Delegation, DeliveryCity, Product, ProductVariant
from app.security import hash_password
from app.seed_catalog import BRAND, PRODUCTS, STORAGE, SeedProduct
from app.seed_delegations import DELEGATIONS

cli = typer.Typer(no_args_is_help=True)

SEED_MEDIA = Path(__file__).resolve().parent.parent / "seed_media"

CATEGORIES = [
    # slug, name_en, name_fr, sort
    ("spreads", "Hazelnut & nut spreads", "Crèmes à tartiner", 1),
    ("rocher", "Crunchy rocher spreads", "Crèmes rocher", 2),
    ("glazes", "Glazing pastes", "Pâtes à glacer", 3),
    ("baking", "Baking essentials", "Pâtisserie", 4),
]

ARABIC_CATEGORIES = {
    "spreads": "كريمات للدهن",
    "rocher": "كريمات روشيه المقرمشة",
    "glazes": "عجائن التغطية",
    "baking": "مستلزمات الحلويات",
}
# Arabic names of the governorates, keyed by the French name.
ARABIC_CITIES = {
    "Tunis": "تونس", "Ariana": "أريانة", "Ben Arous": "بن عروس", "La Manouba": "منوبة",
    "Nabeul": "نابل", "Bizerte": "بنزرت", "Zaghouan": "زغوان", "Béja": "باجة",
    "Jendouba": "جندوبة", "Le Kef": "الكاف", "Siliana": "سليانة", "Sousse": "سوسة",
    "Monastir": "المنستير", "Mahdia": "المهدية", "Kairouan": "القيروان", "Sfax": "صفاقس",
    "Kasserine": "القصرين", "Sidi Bouzid": "سيدي بوزيد", "Gafsa": "قفصة", "Tozeur": "توزر",
    "Kébili": "قبلي", "Gabès": "قابس", "Médenine": "مدنين", "Tataouine": "تطاوين",
}  # fmt: skip


async def _fill_arabic(session) -> int:
    """Add Arabic copy to seeded rows that don't have any yet (never overwrites edits)."""
    filled = 0
    for category in await session.scalars(select(Category)):
        if not category.name_ar and category.slug in ARABIC_CATEGORIES:
            category.name_ar = ARABIC_CATEGORIES[category.slug]
            filled += 1
    for city in await session.scalars(select(DeliveryCity)):
        if not city.name_ar and city.name_fr in ARABIC_CITIES:
            city.name_ar = ARABIC_CITIES[city.name_fr]
            filled += 1
    await session.commit()
    return filled


# The 24 governorates of Tunisia. Fees (TND) are placeholders by region; adjust in the admin panel.
GRAND_TUNIS, NORTH_CENTER, SOUTH = "7.000", "8.000", "9.000"
DELIVERY_CITIES = [
    # name_en, name_fr, fee
    ("Tunis", "Tunis", GRAND_TUNIS),
    ("Ariana", "Ariana", GRAND_TUNIS),
    ("Ben Arous", "Ben Arous", GRAND_TUNIS),
    ("Manouba", "La Manouba", GRAND_TUNIS),
    ("Nabeul", "Nabeul", NORTH_CENTER),
    ("Bizerte", "Bizerte", NORTH_CENTER),
    ("Zaghouan", "Zaghouan", NORTH_CENTER),
    ("Beja", "Béja", NORTH_CENTER),
    ("Jendouba", "Jendouba", NORTH_CENTER),
    ("Kef", "Le Kef", NORTH_CENTER),
    ("Siliana", "Siliana", NORTH_CENTER),
    ("Sousse", "Sousse", NORTH_CENTER),
    ("Monastir", "Monastir", NORTH_CENTER),
    ("Mahdia", "Mahdia", NORTH_CENTER),
    ("Kairouan", "Kairouan", NORTH_CENTER),
    ("Sfax", "Sfax", NORTH_CENTER),
    ("Kasserine", "Kasserine", SOUTH),
    ("Sidi Bouzid", "Sidi Bouzid", SOUTH),
    ("Gafsa", "Gafsa", SOUTH),
    ("Tozeur", "Tozeur", SOUTH),
    ("Kebili", "Kébili", SOUTH),
    ("Gabes", "Gabès", SOUTH),
    ("Medenine", "Médenine", SOUTH),
    ("Tataouine", "Tataouine", SOUTH),
]


def run(coro):
    async def _wrapped():
        try:
            return await coro
        finally:
            await engine.dispose()

    return asyncio.run(_wrapped())


def _copy_seed_image(name: str, folder: str) -> str | None:
    """Copy seed_media/<folder>/<name>.<ext> to the same relative path under MEDIA_DIR."""
    for ext in ("webp", "jpg", "png"):
        source = SEED_MEDIA / folder / f"{name}.{ext}"
        if source.exists():
            relative = source.relative_to(SEED_MEDIA).as_posix()
            target = get_settings().media_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            return relative
    return None


async def _seed_cities(session) -> int:
    """Insert any missing governorate (matched on the French name); never touches edited ones."""
    existing = set(await session.scalars(select(DeliveryCity.name_fr)))
    created = 0
    for order, (name_en, name_fr, fee) in enumerate(DELIVERY_CITIES, start=1):
        if name_fr in existing:
            continue
        session.add(
            DeliveryCity(name_en=name_en, name_fr=name_fr, fee=Decimal(fee), sort_order=order)
        )
        created += 1
    await session.commit()
    return created


async def _seed_delegations(session) -> int:
    """Add each governorate's missing delegations (matched on French names), keeping edits."""
    created = 0
    cities = await session.scalars(
        select(DeliveryCity).options(selectinload(DeliveryCity.delegations))
    )
    for city in cities:
        known = {d.name_fr for d in city.delegations}
        for order, (name_fr, name_en, name_ar) in enumerate(DELEGATIONS.get(city.name_fr, ())):
            if name_fr in known:
                continue
            city.delegations.append(
                Delegation(name_fr=name_fr, name_en=name_en, name_ar=name_ar, sort_order=order)
            )
            created += 1
    await session.commit()
    return created


async def _ensure_categories(session) -> dict[str, Category]:
    categories: dict[str, Category] = {}
    for slug, name_en, name_fr, sort in CATEGORIES:
        category = await session.scalar(select(Category).where(Category.slug == slug))
        if category is None:
            category = Category(
                slug=slug,
                name_en=name_en,
                name_fr=name_fr,
                name_ar=ARABIC_CATEGORIES.get(slug),
                sort_order=sort,
                image_path=_copy_seed_image(slug, "categories"),
            )
            session.add(category)
        categories[slug] = category
    await session.flush()
    return categories


def _catalog_copy(item: SeedProduct, category: Category) -> dict:
    """The supplier's copy for a product row; prices, stock and availability are separate."""
    return {
        "category_id": category.id,
        "brand": BRAND,
        "name_en": item.name.en,
        "name_fr": item.name.fr,
        "name_ar": item.name.ar,
        "description_en": item.description.en,
        "description_fr": item.description.fr,
        "description_ar": item.description.ar,
        "ingredients_en": item.ingredients.en,
        "ingredients_fr": item.ingredients.fr,
        "ingredients_ar": item.ingredients.ar,
        "storage_en": STORAGE.en,
        "storage_fr": STORAGE.fr,
        "storage_ar": STORAGE.ar,
        "shelf_life_months": item.shelf_life_months,
        "is_featured": item.featured,
    }


def _size_photo(item: SeedProduct, grams: int) -> str | None:
    return _copy_seed_image(f"{item.slug}/{grams}", "products")


def _new_product(item: SeedProduct, category: Category) -> Product:
    return Product(
        slug=item.slug,
        image_path=_copy_seed_image(item.slug, "products"),
        variants=[
            ProductVariant(
                weight_grams=size.grams,
                price=Decimal(size.price),
                stock=size.stock,
                sort_order=i,
                image_path=_size_photo(item, size.grams),
            )
            for i, size in enumerate(item.sizes)
        ],
        **_catalog_copy(item, category),
    )


async def _seed(force: bool) -> None:
    async with SessionLocal() as session:
        typer.echo(f"Seeded {await _seed_cities(session)} delivery cities.")
        typer.echo(f"Seeded {await _seed_delegations(session)} delegations.")
        existing = await session.scalar(select(func.count()).select_from(Category))
        if existing and not force:
            typer.echo("Catalog already has data; use --force to add missing seed items.")
            typer.echo("To apply the supplier's range to an existing shop, run sync-catalog.")
            typer.echo(f"Added Arabic copy to {await _fill_arabic(session)} rows.")
            return

        categories = await _ensure_categories(session)
        created = 0
        for item in PRODUCTS:
            if await session.scalar(select(Product.id).where(Product.slug == item.slug)):
                continue
            session.add(_new_product(item, categories[item.category]))
            created += 1
        await session.commit()
        typer.echo(f"Seeded {len(categories)} categories and {created} products.")
        typer.echo(f"Added Arabic copy to {await _fill_arabic(session)} rows.")


@cli.command()
def seed(force: bool = typer.Option(False, help="Add missing items even if data exists")):
    """Load delivery cities plus the categories and the CEBON product range."""
    run(_seed(force))


async def _sync_catalog() -> None:
    async with SessionLocal() as session:
        categories = await _ensure_categories(session)
        replaced: list[str] = []  # uploaded photos superseded by the supplier's, deleted at the end
        added = updated = sizes_added = sizes_off = retired = 0

        for item in PRODUCTS:
            product = await session.scalar(
                select(Product)
                .where(Product.slug == item.slug)
                .options(selectinload(Product.variants))
            )
            if product is None:
                session.add(_new_product(item, categories[item.category]))
                added += 1
                continue

            for field, value in _catalog_copy(item, categories[item.category]).items():
                setattr(product, field, value)
            photo = _copy_seed_image(item.slug, "products")
            if photo and product.image_path != photo:
                replaced.append(product.image_path)
                product.image_path = photo

            by_weight = {v.weight_grams: v for v in product.variants}
            for i, size in enumerate(item.sizes):
                variant = by_weight.pop(size.grams, None)
                photo = _size_photo(item, size.grams)
                if variant is None:
                    product.variants.append(
                        ProductVariant(
                            weight_grams=size.grams,
                            price=Decimal(size.price),
                            stock=size.stock,
                            sort_order=i,
                            image_path=photo,
                        )
                    )
                    sizes_added += 1
                    continue
                variant.sort_order = i  # price, stock and availability stay as the shop set them
                if photo and variant.image_path != photo:
                    replaced.append(variant.image_path)
                    variant.image_path = photo
            # Sizes outside the range may have been ordered: switch them off, keep the history.
            for offset, variant in enumerate(by_weight.values(), start=len(item.sizes)):
                variant.sort_order = offset
                if variant.is_available:
                    variant.is_available = False
                    sizes_off += 1
            updated += 1

        slugs = [item.slug for item in PRODUCTS]
        for product in await session.scalars(
            select(Product).where(Product.slug.not_in(slugs), Product.is_available)
        ):
            product.is_available = False
            retired += 1

        await session.commit()
        for path in replaced:
            delete_image(path)
        typer.echo(
            f"Catalogue synced: {added} products added, {updated} updated "
            f"({sizes_added} sizes added, {sizes_off} switched off), "
            f"{retired} products outside the range switched off."
        )


@cli.command("sync-catalog")
def sync_catalog():
    """Apply the CEBON range to an existing shop.

    Adds missing products and sizes, refreshes names, descriptions, ingredients and photos,
    and switches off (never deletes) products and sizes that aren't in the range. Prices,
    stock and orders are kept.
    """
    run(_sync_catalog())


async def _seed_cities_only() -> None:
    async with SessionLocal() as session:
        typer.echo(f"Seeded {await _seed_cities(session)} delivery cities.")
        typer.echo(f"Seeded {await _seed_delegations(session)} delegations.")
        typer.echo(f"Added Arabic copy to {await _fill_arabic(session)} rows.")


@cli.command("seed-cities")
def seed_cities():
    """Load only the Tunisian governorates and their delegations (safe for production)."""
    run(_seed_cities_only())


async def _create_admin(email: str, password: str) -> None:
    async with SessionLocal() as session:
        admin = await session.scalar(
            select(AdminUser).where(func.lower(AdminUser.email) == email.lower())
        )
        if admin:
            admin.password_hash = hash_password(password)
            admin.is_active = True
            action = "Updated password for"
        else:
            session.add(AdminUser(email=email.lower(), password_hash=hash_password(password)))
            action = "Created"
        await session.commit()
        typer.echo(f"{action} admin {email.lower()}")


@cli.command("create-admin")
def create_admin(
    email: str = typer.Option(..., prompt=True),
    password: str = typer.Option(..., prompt=True, hide_input=True, confirmation_prompt=True),
):
    """Create an admin user (or reset an existing admin's password)."""
    if len(password) < 8:
        raise typer.BadParameter("password must be at least 8 characters")
    run(_create_admin(email, password))


if __name__ == "__main__":
    cli()
