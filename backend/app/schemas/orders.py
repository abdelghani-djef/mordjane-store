from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import OrderStatus

PHONE_PATTERN = r"^\+?[0-9 ]{8,20}$"


def normalize_phone(value: str) -> str:
    return value.replace(" ", "")


class OrderLineIn(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0, le=99)


class OrderIn(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(pattern=PHONE_PATTERN)
    # Required: the confirmation, tracking code and delivery updates are emailed.
    email: EmailStr
    address: str = Field(min_length=4, max_length=255)
    delivery_city_id: int  # the governorate (sets the fee)
    delegation_id: int  # a delegation of that governorate
    # Language of the shop when ordering; the customer's emails use it.
    locale: Literal["en", "fr", "ar"] = "fr"
    notes: str = Field("", max_length=1000)
    items: list[OrderLineIn] = Field(min_length=1, max_length=50)

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("items")
    @classmethod
    def _unique_sizes(cls, items: list[OrderLineIn]) -> list[OrderLineIn]:
        ids = [i.variant_id for i in items]
        if len(ids) != len(set(ids)):
            raise ValueError("each product size may appear only once")
        return items


class DelegationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_en: str
    name_fr: str
    name_ar: str | None


class DelegationAdminOut(DelegationOut):
    city_id: int
    sort_order: int
    is_active: bool


class DelegationIn(BaseModel):
    name_fr: str = Field(min_length=1, max_length=120)
    name_en: str | None = Field(None, max_length=120)  # defaults to the French name
    name_ar: str | None = Field(None, max_length=120)
    sort_order: int = 0
    is_active: bool = True


class DelegationPatch(BaseModel):
    name_fr: str | None = Field(None, min_length=1, max_length=120)
    name_en: str | None = Field(None, min_length=1, max_length=120)
    name_ar: str | None = Field(None, max_length=120)
    sort_order: int | None = None
    is_active: bool | None = None


class DeliveryCityOut(BaseModel):
    """A governorate with the delegations customers can pick in it."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name_en: str
    name_fr: str
    name_ar: str | None
    fee: Decimal
    delegations: list[DelegationOut] = Field(validation_alias="active_delegations")


class DeliveryCityAdminOut(DeliveryCityOut):
    sort_order: int
    is_active: bool
    order_count: int = 0
    delegations: list[DelegationAdminOut] = Field(validation_alias="delegations")


class DeliveryCityIn(BaseModel):
    name_en: str = Field(min_length=1, max_length=120)
    name_fr: str = Field(min_length=1, max_length=120)
    name_ar: str | None = Field(None, max_length=120)
    fee: Decimal = Field(ge=0, max_digits=12, decimal_places=3)
    sort_order: int = 0
    is_active: bool = True


class DeliveryCityPatch(BaseModel):
    name_en: str | None = Field(None, min_length=1, max_length=120)
    name_fr: str | None = Field(None, min_length=1, max_length=120)
    name_ar: str | None = Field(None, max_length=120)
    fee: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=3)
    sort_order: int | None = None
    is_active: bool | None = None


class OrderCreatedOut(BaseModel):
    code: str
    total: Decimal


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int | None
    variant_id: int | None
    product_name: str
    product_name_fr: str
    product_name_ar: str | None
    weight_grams: int | None
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class PublicStatusEventOut(BaseModel):
    """Timeline entry shown to customers: no staff notes."""

    model_config = ConfigDict(from_attributes=True)

    from_status: OrderStatus | None
    to_status: OrderStatus
    created_at: datetime


class StatusEventOut(PublicStatusEventOut):
    note: str


class OrderTrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    status: OrderStatus
    created_at: datetime
    city: str
    delegation: str  # empty on orders placed before delegations existed
    subtotal: Decimal
    delivery_fee: Decimal
    total: Decimal
    items: list[OrderItemOut]
    events: list[PublicStatusEventOut]


class OrderSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    status: OrderStatus
    customer_name: str
    phone: str
    city: str
    delegation: str
    total: Decimal
    item_count: int = 0
    created_at: datetime


class OrderAdminOut(OrderTrackOut):
    events: list[StatusEventOut]  # staff see the internal notes
    id: int
    customer_name: str
    phone: str
    email: str | None
    address: str
    notes: str
    locale: str  # the shop language the customer ordered in; their emails use it
    updated_at: datetime
    allowed_transitions: list[OrderStatus] = []


class StatusChangeIn(BaseModel):
    to_status: OrderStatus
    note: str = Field("", max_length=1000)


class StockProblem(BaseModel):
    variant_id: int
    reason: str  # "not_found" | "unavailable" | "insufficient_stock"
    available: int = 0


class OrderConflictOut(BaseModel):
    detail: str
    problems: list[StockProblem]


class LowStockOut(BaseModel):
    """A size running low (or out)."""

    variant_id: int
    product_id: int
    name_en: str
    name_fr: str
    weight_grams: int
    stock: int
    is_available: bool


class AdminStatsOut(BaseModel):
    orders_by_status: dict[OrderStatus, int]
    revenue_delivered: Decimal
    low_stock: list[LowStockOut]
    low_stock_threshold: int
