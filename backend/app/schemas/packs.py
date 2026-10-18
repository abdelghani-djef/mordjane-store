from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.schemas.catalog import (
    MONEY,
    SLUG_PATTERN,
    VariantAdminOut,
    VariantDetailOut,
    media_url,
)

MAX_PACK_LINES = 12
NO_SAVING = "The pack price must be lower than its 'instead of' price"


class PackProductOut(BaseModel):
    """The product a pack item belongs to: enough to name it and link to it."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name_en: str
    name_fr: str
    name_ar: str | None
    image_path: str | None = Field(exclude=True)

    @computed_field
    @property
    def image_url(self) -> str | None:
        return media_url(self.image_path)


class PackItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    quantity: int
    variant: VariantDetailOut
    product: PackProductOut


class PackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name_en: str
    name_fr: str
    name_ar: str | None
    description_en: str
    description_fr: str
    description_ar: str
    price: Decimal
    # The "instead of" price, shown struck through next to `price`.
    regular_price: Decimal
    in_stock: bool
    boxes_left: int
    is_featured: bool
    items: list[PackItemOut]
    image_path: str | None = Field(exclude=True)

    @computed_field
    @property
    def image_url(self) -> str | None:
        return media_url(self.image_path)


class PackAdminItemOut(PackItemOut):
    variant: VariantAdminOut


class PackAdminOut(PackOut):
    items: list[PackAdminItemOut]
    is_available: bool
    sort_order: int
    # Why customers can't buy it right now, if anything.
    problem: Literal["item_unavailable", "out_of_stock"] | None
    created_at: datetime
    updated_at: datetime


class PackItemIn(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0, le=50)


def _check_items(items: list[PackItemIn]) -> list[PackItemIn]:
    ids = [i.variant_id for i in items]
    if len(ids) != len(set(ids)):
        raise ValueError("Each size can appear only once; raise its quantity instead")
    if sum(i.quantity for i in items) < 2:
        raise ValueError("A pack holds at least 2 items")
    return items


class _PackFields(BaseModel):
    name_ar: str | None = Field(None, max_length=160)
    description_en: str = ""
    description_fr: str = ""
    description_ar: str = ""
    is_available: bool = True
    is_featured: bool = False
    sort_order: int = 0


class PackIn(_PackFields):
    slug: str = Field(min_length=1, max_length=160, pattern=SLUG_PATTERN)
    name_en: str = Field(min_length=1, max_length=160)
    name_fr: str = Field(min_length=1, max_length=160)
    price: Decimal = Field(ge=0, **MONEY)
    regular_price: Decimal = Field(gt=0, **MONEY)
    items: list[PackItemIn] = Field(min_length=1, max_length=MAX_PACK_LINES)

    @field_validator("items")
    @classmethod
    def _valid_items(cls, items: list[PackItemIn]) -> list[PackItemIn]:
        return _check_items(items)

    @model_validator(mode="after")
    def _saves_money(self) -> PackIn:
        if self.price >= self.regular_price:
            raise ValueError(NO_SAVING)
        return self


class PackPatch(BaseModel):
    slug: str | None = Field(None, min_length=1, max_length=160, pattern=SLUG_PATTERN)
    name_en: str | None = Field(None, min_length=1, max_length=160)
    name_fr: str | None = Field(None, min_length=1, max_length=160)
    name_ar: str | None = Field(None, max_length=160)
    description_en: str | None = None
    description_fr: str | None = None
    description_ar: str | None = None
    price: Decimal | None = Field(None, ge=0, **MONEY)
    regular_price: Decimal | None = Field(None, gt=0, **MONEY)
    # Replaces the whole contents when given.
    items: list[PackItemIn] | None = Field(None, min_length=1, max_length=MAX_PACK_LINES)
    is_available: bool | None = None
    is_featured: bool | None = None
    sort_order: int | None = None

    @field_validator("items")
    @classmethod
    def _valid_items(cls, items: list[PackItemIn] | None) -> list[PackItemIn] | None:
        return None if items is None else _check_items(items)
