from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import Category, Product, ProductVariant
from app.schemas.catalog import CategoryOut, Page, ProductDetailOut, ProductOut

router = APIRouter(tags=["catalog"])

Session = Annotated[AsyncSession, Depends(get_session)]

SortKey = Literal["featured", "newest", "price_asc", "price_desc", "name"]

_sellable = (ProductVariant.product_id == Product.id) & ProductVariant.is_available.is_(True)
# "From" price and total stock across the sizes on sale, for sorting.
_min_price = select(func.min(ProductVariant.price)).where(_sellable).correlate(Product)
_total_stock = select(func.coalesce(func.sum(ProductVariant.stock), 0)).where(_sellable)

_ORDERING = {
    "featured": (
        Product.is_featured.desc(),
        _total_stock.correlate(Product).scalar_subquery().desc(),
        Product.id.desc(),
    ),
    "newest": (Product.created_at.desc(), Product.id.desc()),
    "price_asc": (_min_price.scalar_subquery().asc(), Product.id),
    "price_desc": (_min_price.scalar_subquery().desc(), Product.id),
    "name": (Product.name_en.asc(), Product.id),
}


def _visible_products():
    """Products shown in the shop: switched on, in an active category, with a size on sale.

    Out-of-stock products stay listed (shown as sold out) so customers can still find them.
    """
    return (
        select(Product)
        .join(Product.category)
        .where(
            Product.is_available.is_(True),
            Category.is_active.is_(True),
            exists().where(_sellable),
        )
        .options(selectinload(Product.variants))
    )


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: Session):
    rows = await session.scalars(
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.sort_order, Category.name_en)
    )
    return rows.all()


@router.get("/products", response_model=Page[ProductOut])
async def list_products(
    session: Session,
    category: str | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    featured: bool | None = None,
    sort: SortKey = "featured",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 24,
):
    stmt = _visible_products()
    if category:
        stmt = stmt.where(Category.slug == category)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name_en.ilike(pattern),
                Product.name_fr.ilike(pattern),
                Product.name_ar.ilike(pattern),
            )
        )
    if featured is not None:
        stmt = stmt.where(Product.is_featured.is_(featured))

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await session.scalars(
        stmt.order_by(*_ORDERING[sort]).offset((page - 1) * page_size).limit(page_size)
    )
    return Page(items=rows.all(), total=total or 0, page=page, page_size=page_size)


@router.get("/products/{slug}", response_model=ProductDetailOut)
async def get_product(slug: str, session: Session):
    product = await session.scalar(
        _visible_products().where(Product.slug == slug).options(selectinload(Product.category))
    )
    if product is None:
        raise HTTPException(404, "Product not found")
    return product
