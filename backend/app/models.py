import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Tunisian dinar: 3 decimal places (millimes).
Money = Numeric(12, 3)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OrderStatus(enum.StrEnum):
    pending = "pending"
    validated = "validated"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_fr: Mapped[str] = mapped_column(String(120))
    # Arabic is for the storefront only; empty means "show the French name".
    name_ar: Mapped[str | None] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)
    image_path: Mapped[str | None] = mapped_column(String(255))

    products: Mapped[list[Product]] = relationship(back_populates="category")


class Product(TimestampMixin, Base):
    """Shared information for a product; what's actually bought is one of its sizes."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    name_en: Mapped[str] = mapped_column(String(160))
    name_fr: Mapped[str] = mapped_column(String(160))
    description_en: Mapped[str] = mapped_column(Text, default="")
    description_fr: Mapped[str] = mapped_column(Text, default="")
    # Arabic storefront copy (optional; falls back to French).
    name_ar: Mapped[str | None] = mapped_column(String(160))
    description_ar: Mapped[str] = mapped_column(Text, default="", server_default="")
    ingredients_ar: Mapped[str] = mapped_column(Text, default="", server_default="")
    storage_ar: Mapped[str] = mapped_column(Text, default="", server_default="")
    brand: Mapped[str | None] = mapped_column(String(80))
    ingredients_en: Mapped[str] = mapped_column(Text, default="")
    ingredients_fr: Mapped[str] = mapped_column(Text, default="")
    storage_en: Mapped[str] = mapped_column(Text, default="")
    storage_fr: Mapped[str] = mapped_column(Text, default="")
    shelf_life_months: Mapped[int | None] = mapped_column(Integer)
    is_available: Mapped[bool] = mapped_column(default=True)
    is_featured: Mapped[bool] = mapped_column(default=False)
    image_path: Mapped[str | None] = mapped_column(String(255))

    category: Mapped[Category] = relationship(back_populates="products")
    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="(ProductVariant.sort_order, ProductVariant.weight_grams)",
    )

    # These read `variants`, so load them (selectinload) before serialising.
    @property
    def in_stock(self) -> bool:
        return self.is_available and any(v.in_stock for v in self.variants)

    @property
    def public_variants(self) -> list[ProductVariant]:
        return [v for v in self.variants if v.is_available]

    @property
    def min_price(self) -> Decimal | None:
        """Lowest price a customer can buy it at ("from 7.900 DT")."""
        prices = [v.price for v in self.variants if v.in_stock] or [
            v.price for v in self.public_variants
        ]
        return min(prices) if prices else None


class ProductVariant(TimestampMixin, Base):
    """A size of a product (e.g. 200 g, 2.5 kg) with its own price and stock."""

    __tablename__ = "product_variants"
    __table_args__ = (
        CheckConstraint("stock >= 0", name="stock_non_negative"),
        CheckConstraint("price >= 0", name="price_non_negative"),
        CheckConstraint("weight_grams > 0", name="weight_positive"),
        UniqueConstraint("product_id", "weight_grams", name="uq_variant_size"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    weight_grams: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Money)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    # Photo of this size (the 200 g jar, the 12 kg bucket…); the product photo is the fallback.
    image_path: Mapped[str | None] = mapped_column(String(255))
    is_available: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="variants")

    @property
    def in_stock(self) -> bool:
        return self.is_available and self.stock > 0


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (Index("ix_orders_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"), default=OrderStatus.pending, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32))
    # Language the customer ordered in; their emails are written in it.
    locale: Mapped[str] = mapped_column(String(2), default="fr", server_default="fr")
    email: Mapped[str | None] = mapped_column(String(254))
    address: Mapped[str] = mapped_column(String(255))
    delivery_city_id: Mapped[int | None] = mapped_column(
        ForeignKey("delivery_cities.id", ondelete="SET NULL"), index=True
    )
    # Snapshot of the city name, so renaming/deleting a city never rewrites past orders.
    city: Mapped[str] = mapped_column(String(120))
    # The delegation within that governorate, snapshotted (French name) the same way.
    delegation_id: Mapped[int | None] = mapped_column(
        ForeignKey("delegations.id", ondelete="SET NULL"), index=True
    )
    delegation: Mapped[str] = mapped_column(String(120), default="", server_default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    subtotal: Mapped[Decimal] = mapped_column(Money)
    delivery_fee: Mapped[Decimal] = mapped_column(Money)
    total: Mapped[Decimal] = mapped_column(Money)

    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )
    events: Mapped[list[OrderStatusEvent]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderStatusEvent.id"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), index=True
    )
    variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="SET NULL"), index=True
    )
    # Snapshots so later catalog edits never rewrite past orders.
    product_name: Mapped[str] = mapped_column(String(160))
    product_name_fr: Mapped[str] = mapped_column(String(160))
    product_name_ar: Mapped[str | None] = mapped_column(String(160))
    weight_grams: Mapped[int | None] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Money)
    quantity: Mapped[int] = mapped_column(Integer)
    line_total: Mapped[Decimal] = mapped_column(Money)

    order: Mapped[Order] = relationship(back_populates="items")


class OrderStatusEvent(Base):
    __tablename__ = "order_status_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[OrderStatus | None] = mapped_column(Enum(OrderStatus, name="order_status"))
    to_status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="order_status"))
    note: Mapped[str] = mapped_column(Text, default="")
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped[Order] = relationship(back_populates="events")


class DeliveryCity(TimestampMixin, Base):
    """A governorate (wilaya): where the delivery fee is set. Customers then pick a delegation."""

    __tablename__ = "delivery_cities"
    __table_args__ = (CheckConstraint("fee >= 0", name="fee_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_fr: Mapped[str] = mapped_column(String(120), unique=True)
    name_ar: Mapped[str | None] = mapped_column(String(120))
    fee: Mapped[Decimal] = mapped_column(Money)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    delegations: Mapped[list[Delegation]] = relationship(
        back_populates="city",
        cascade="all, delete-orphan",
        order_by="(Delegation.sort_order, Delegation.name_fr)",
    )

    # Reads `delegations`: load them (selectinload) before serialising.
    @property
    def active_delegations(self) -> list[Delegation]:
        return [d for d in self.delegations if d.is_active]


class Delegation(TimestampMixin, Base):
    """A delegation (mu'tamadiya) of a governorate: the town or district the customer picks."""

    __tablename__ = "delegations"
    __table_args__ = (UniqueConstraint("city_id", "name_fr", name="uq_delegation_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(
        ForeignKey("delivery_cities.id", ondelete="CASCADE"), index=True
    )
    name_en: Mapped[str] = mapped_column(String(120))
    name_fr: Mapped[str] = mapped_column(String(120))
    name_ar: Mapped[str | None] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    city: Mapped[DeliveryCity] = relationship(back_populates="delegations")


class NotificationSettings(TimestampMixin, Base):
    """Who gets which emails. A single row (id = 1), edited from the admin panel."""

    __tablename__ = "notification_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row"),
        CheckConstraint("low_stock_threshold >= 0", name="threshold_non_negative"),
        CheckConstraint("admin_language IN ('en', 'fr')", name="admin_language_known"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    # Staff inboxes for order and stock emails.
    admin_recipients: Mapped[list[str]] = mapped_column(ARRAY(String(254)), default=list)
    admin_language: Mapped[str] = mapped_column(String(2), default="fr")
    notify_admin_new_order: Mapped[bool] = mapped_column(default=True)
    notify_admin_status_change: Mapped[bool] = mapped_column(default=True)
    notify_admin_low_stock: Mapped[bool] = mapped_column(default=True)
    # A size is "low" at or below this many units: alert once when stock crosses it.
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5)
    notify_customer_confirmation: Mapped[bool] = mapped_column(default=True)
    notify_customer_validated: Mapped[bool] = mapped_column(default=False)
    notify_customer_shipped: Mapped[bool] = mapped_column(default=False)
    notify_customer_delivered: Mapped[bool] = mapped_column(default=True)
    notify_customer_cancelled: Mapped[bool] = mapped_column(default=True)


class AdminUser(TimestampMixin, Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
