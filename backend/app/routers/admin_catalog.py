from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.media import delete_image, save_image
from app.models import Category, OrderItem, Product, ProductVariant
from app.schemas.catalog import (
    CategoryAdminOut,
    CategoryIn,
    CategoryPatch,
    Page,
    ProductAdminOut,
    ProductIn,
    ProductPatch,
    VariantIn,
    VariantPatch,
)
from app.security import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

Session = Annotated[AsyncSession, Depends(get_session)]


async def _commit_or_conflict(session: AsyncSession, what: str) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A {what} with this slug already exists"
        ) from exc


# --- categories ---------------------------------------------------------------------------


async def _category_out(session: AsyncSession, category: Category) -> CategoryAdminOut:
    count = await session.scalar(
        select(func.count()).select_from(Product).where(Product.category_id == category.id)
    )
    out = CategoryAdminOut.model_validate(category)
    out.product_count = count or 0
    return out


@router.get("/categories", response_model=list[CategoryAdminOut])
async def list_categories(session: Session):
    counts = (
        select(Product.category_id, func.count().label("n"))
        .group_by(Product.category_id)
        .subquery()
    )
    rows = await session.execute(
        select(Category, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.category_id == Category.id)
        .order_by(Category.sort_order, Category.name_en)
    )
    result = []
    for category, count in rows:
        out = CategoryAdminOut.model_validate(category)
        out.product_count = count
        result.append(out)
    return result


@router.post("/categories", response_model=CategoryAdminOut, status_code=201)
async def create_category(data: CategoryIn, session: Session):
    category = Category(**data.model_dump())
    session.add(category)
    await _commit_or_conflict(session, "category")
    return await _category_out(session, category)


@router.patch("/categories/{category_id}", response_model=CategoryAdminOut)
async def update_category(category_id: int, data: CategoryPatch, session: Session):
    category = await session.get(Category, category_id)
    if category is None:
        raise HTTPException(404, "Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await _commit_or_conflict(session, "category")
    return await _category_out(session, category)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: int, session: Session):
    category = await session.get(Category, category_id)
    if category is None:
        raise HTTPException(404, "Category not found")
    in_use = await session.scalar(select(Product.id).where(Product.category_id == category_id))
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Category still has products; move or delete them first, or deactivate it",
        )
    image = category.image_path
    await session.delete(category)
    await session.commit()
    delete_image(image)


@router.post("/categories/{category_id}/image", response_model=CategoryAdminOut)
async def upload_category_image(category_id: int, file: UploadFile, session: Session):
    category = await session.get(Category, category_id)
    if category is None:
        raise HTTPException(404, "Category not found")
    old = category.image_path
    category.image_path = await save_image(file, "categories")
    await session.commit()
    delete_image(old)
    return await _category_out(session, category)


# --- products -----------------------------------------------------------------------------


async def _ensure_category(session: AsyncSession, category_id: int | None) -> None:
    if category_id is not None and await session.get(Category, category_id) is None:
        raise HTTPException(422, "Category does not exist")


async def _get_product(
    session: AsyncSession, product_id: int, *, for_update: bool = False
) -> Product:
    stmt = select(Product).where(Product.id == product_id)
    if for_update:
        stmt = stmt.with_for_update()
    product = await session.scalar(stmt)
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


async def _product_out(session: AsyncSession, product_id: int) -> Product:
    """Fresh product with its sizes, for responses after a change."""
    product = await session.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.variants))
        .execution_options(populate_existing=True)
    )
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


@router.get("/products", response_model=Page[ProductAdminOut])
async def list_products(
    session: Session,
    category_id: int | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    available: bool | None = None,
    low_stock: Annotated[int | None, Query(ge=0)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
):
    stmt = select(Product)
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name_en.ilike(pattern),
                Product.name_fr.ilike(pattern),
                Product.name_ar.ilike(pattern),
                Product.slug.ilike(pattern),
                Product.brand.ilike(pattern),
            )
        )
    if available is not None:
        stmt = stmt.where(Product.is_available.is_(available))
    if low_stock is not None:
        stmt = stmt.where(
            exists().where(
                ProductVariant.product_id == Product.id, ProductVariant.stock <= low_stock
            )
        )
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await session.scalars(
        stmt.options(selectinload(Product.variants))
        .order_by(Product.updated_at.desc(), Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return Page(items=rows.all(), total=total or 0, page=page, page_size=page_size)


@router.get("/products/{product_id}", response_model=ProductAdminOut)
async def get_product(product_id: int, session: Session):
    return await _product_out(session, product_id)


@router.post("/products", response_model=ProductAdminOut, status_code=201)
async def create_product(data: ProductIn, session: Session):
    await _ensure_category(session, data.category_id)
    fields = data.model_dump(exclude={"variants"})
    product = Product(**fields, variants=[ProductVariant(**v.model_dump()) for v in data.variants])
    session.add(product)
    await _commit_or_conflict(session, "product")
    return await _product_out(session, product.id)


@router.patch("/products/{product_id}", response_model=ProductAdminOut)
async def update_product(product_id: int, data: ProductPatch, session: Session):
    product = await _get_product(session, product_id)
    changes = data.model_dump(exclude_unset=True)
    for field in ("category_id", "slug", "name_en", "name_fr"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    await _ensure_category(session, changes.get("category_id"))
    for field, value in changes.items():
        setattr(product, field, value)
    await _commit_or_conflict(session, "product")
    return await _product_out(session, product_id)


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: int, session: Session):
    product = await _get_product(session, product_id)
    ordered = await session.scalar(select(OrderItem.id).where(OrderItem.product_id == product_id))
    if ordered:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Product appears in past orders; mark it unavailable instead of deleting it",
        )
    # Its sizes go with it (cascade), so collect their photos before the rows are gone.
    size_images = (
        await session.scalars(
            select(ProductVariant.image_path).where(ProductVariant.product_id == product_id)
        )
    ).all()
    image = product.image_path
    await session.delete(product)
    await session.commit()
    for path in (image, *size_images):
        delete_image(path)


@router.post("/products/{product_id}/image", response_model=ProductAdminOut)
async def upload_product_image(product_id: int, file: UploadFile, session: Session):
    product = await _get_product(session, product_id)
    old = product.image_path
    product.image_path = await save_image(file, "products")
    await session.commit()
    delete_image(old)
    return await _product_out(session, product_id)


# --- sizes (variants) ---------------------------------------------------------------------


async def _commit_size(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This product already has a size with that weight",
        ) from exc


async def _get_variant(session: AsyncSession, variant_id: int) -> ProductVariant:
    variant = await session.get(ProductVariant, variant_id)
    if variant is None:
        raise HTTPException(404, "Size not found")
    return variant


@router.post("/products/{product_id}/variants", response_model=ProductAdminOut, status_code=201)
async def add_variant(product_id: int, data: VariantIn, session: Session):
    await _get_product(session, product_id)
    session.add(ProductVariant(product_id=product_id, **data.model_dump()))
    await _commit_size(session)
    return await _product_out(session, product_id)


@router.patch("/variants/{variant_id}", response_model=ProductAdminOut)
async def update_variant(variant_id: int, data: VariantPatch, session: Session):
    # Lock the row like checkout does, so a stock edit and a sale can't interleave.
    variant = await session.scalar(
        select(ProductVariant).where(ProductVariant.id == variant_id).with_for_update()
    )
    if variant is None:
        raise HTTPException(404, "Size not found")
    product_id = variant.product_id
    changes = data.model_dump(exclude_unset=True)
    expected_stock = changes.pop("expected_stock", None)
    current_stock = variant.stock  # read before rollback() expires the instance
    if "stock" in changes and expected_stock is not None and current_stock != expected_stock:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Stock changed to {current_stock} since you loaded it (orders came in). "
            "Check the new figure and save again.",
        )
    for field in ("weight_grams", "price", "stock"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    for field, value in changes.items():
        setattr(variant, field, value)
    await _commit_size(session)
    return await _product_out(session, product_id)


@router.delete("/variants/{variant_id}", response_model=ProductAdminOut)
async def delete_variant(variant_id: int, session: Session):
    variant = await _get_variant(session, variant_id)
    product_id = variant.product_id
    if await session.scalar(select(OrderItem.id).where(OrderItem.variant_id == variant_id)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This size appears in past orders; switch it off instead of deleting it",
        )
    siblings = await session.scalar(
        select(func.count()).where(ProductVariant.product_id == product_id)
    )
    if siblings <= 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "A product needs at least one size")
    image = variant.image_path
    await session.delete(variant)
    await session.commit()
    delete_image(image)
    return await _product_out(session, product_id)


@router.post("/variants/{variant_id}/image", response_model=ProductAdminOut)
async def upload_variant_image(variant_id: int, file: UploadFile, session: Session):
    variant = await _get_variant(session, variant_id)
    product_id = variant.product_id
    old = variant.image_path
    variant.image_path = await save_image(file, "products")
    await session.commit()
    delete_image(old)
    return await _product_out(session, product_id)


@router.delete("/variants/{variant_id}/image", response_model=ProductAdminOut)
async def delete_variant_image(variant_id: int, session: Session):
    variant = await _get_variant(session, variant_id)
    product_id = variant.product_id
    old = variant.image_path
    variant.image_path = None
    await session.commit()
    delete_image(old)
    return await _product_out(session, product_id)
