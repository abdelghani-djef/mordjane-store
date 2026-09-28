from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


def media_url(path: str | None) -> str | None:
    return f"/media/{path}" if path else None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name_en: str
    name_fr: str
    name_ar: str | None
    sort_order: int
    image_path: str | None = Field(exclude=True)

    @computed_field
    @property
    def image_url(self) -> str | None:
        return media_url(self.image_path)


class CategoryAdminOut(CategoryOut):
    is_active: bool
    product_count: int = 0


class CategoryIn(BaseModel):
    slug: str = Field(min_length=1, max_length=120, pattern=SLUG_PATTERN)
    name_en: str = Field(min_length=1, max_length=120)
    name_fr: str = Field(min_length=1, max_length=120)
    name_ar: str | None = Field(None, max_length=120)
    sort_order: int = 0
    is_active: bool = True


class CategoryPatch(BaseModel):
    slug: str | None = Field(None, min_length=1, max_length=120, pattern=SLUG_PATTERN)
    name_en: str | None = Field(None, min_length=1, max_length=120)
    name_fr: str | None = Field(None, min_length=1, max_length=120)
    name_ar: str | None = Field(None, max_length=120)
    sort_order: int | None = None
    is_active: bool | None = None


MONEY = {"max_digits": 12, "decimal_places": 3}


# --- sizes (variants) ---------------------------------------------------------------------


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    weight_grams: int
    price: Decimal
    in_stock: bool
    image_path: str | None = Field(exclude=True)

    @computed_field
    @property
    def image_url(self) -> str | None:
        return media_url(self.image_path)


class VariantDetailOut(VariantOut):
    # Exposed so the cart can cap quantities.
    stock: int


class VariantAdminOut(VariantDetailOut):
    is_available: bool
    sort_order: int


class VariantIn(BaseModel):
    weight_grams: int = Field(gt=0, le=100_000)
    price: Decimal = Field(ge=0, **MONEY)
    stock: int = Field(0, ge=0)
    is_available: bool = True
    sort_order: int = 0


class VariantPatch(BaseModel):
    weight_grams: int | None = Field(None, gt=0, le=100_000)
    price: Decimal | None = Field(None, ge=0, **MONEY)
    stock: int | None = Field(None, ge=0)
    # Stock the editor last saw. If an order changed it since, the edit is refused (409)
    # instead of silently overwriting the sale.
    expected_stock: int | None = Field(None, ge=0)
    is_available: bool | None = None
    sort_order: int | None = None


# --- products -----------------------------------------------------------------------------


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    category_id: int
    brand: str | None
    name_en: str
    name_fr: str
    name_ar: str | None
    description_en: str
    description_fr: str
    description_ar: str
    is_featured: bool
    in_stock: bool
    min_price: Decimal | None
    # Only sizes switched on by the admin are public.
    variants: list[VariantOut] = Field(validation_alias="public_variants")
    image_path: str | None = Field(exclude=True)

    @computed_field
    @property
    def image_url(self) -> str | None:
        return media_url(self.image_path)


class ProductDetailOut(ProductOut):
    category: CategoryOut
    variants: list[VariantDetailOut] = Field(validation_alias="public_variants")
    ingredients_en: str
    ingredients_fr: str
    ingredients_ar: str
    storage_en: str
    storage_fr: str
    storage_ar: str
    shelf_life_months: int | None


class ProductAdminOut(ProductOut):
    variants: list[VariantAdminOut]
    ingredients_en: str
    ingredients_fr: str
    ingredients_ar: str
    storage_en: str
    storage_fr: str
    storage_ar: str
    shelf_life_months: int | None
    is_available: bool
    created_at: datetime
    updated_at: datetime


class _ProductFields(BaseModel):
    brand: str | None = Field(None, max_length=80)
    description_en: str = ""
    description_fr: str = ""
    ingredients_en: str = ""
    ingredients_fr: str = ""
    ingredients_ar: str = ""
    storage_en: str = ""
    storage_fr: str = ""
    storage_ar: str = ""
    name_ar: str | None = Field(None, max_length=160)
    description_ar: str = ""
    shelf_life_months: int | None = Field(None, gt=0, le=120)
    is_available: bool = True
    is_featured: bool = False


class ProductIn(_ProductFields):
    category_id: int
    slug: str = Field(min_length=1, max_length=160, pattern=SLUG_PATTERN)
    name_en: str = Field(min_length=1, max_length=160)
    name_fr: str = Field(min_length=1, max_length=160)
    variants: list[VariantIn] = Field(min_length=1, max_length=20)

    @field_validator("variants")
    @classmethod
    def _one_size_per_weight(cls, variants: list[VariantIn]) -> list[VariantIn]:
        weights = [v.weight_grams for v in variants]
        if len(weights) != len(set(weights)):
            raise ValueError("Two sizes have the same weight")
        return variants


class ProductPatch(BaseModel):
    category_id: int | None = None
    slug: str | None = Field(None, min_length=1, max_length=160, pattern=SLUG_PATTERN)
    name_en: str | None = Field(None, min_length=1, max_length=160)
    name_fr: str | None = Field(None, min_length=1, max_length=160)
    brand: str | None = Field(None, max_length=80)
    description_en: str | None = None
    description_fr: str | None = None
    ingredients_en: str | None = None
    ingredients_fr: str | None = None
    ingredients_ar: str | None = None
    storage_en: str | None = None
    storage_fr: str | None = None
    storage_ar: str | None = None
    name_ar: str | None = Field(None, max_length=160)
    description_ar: str | None = None
    shelf_life_months: int | None = Field(None, gt=0, le=120)
    is_available: bool | None = None
    is_featured: bool | None = None


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
