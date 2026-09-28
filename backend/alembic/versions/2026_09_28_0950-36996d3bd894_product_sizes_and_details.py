"""product sizes and details

Revision ID: 36996d3bd894
Revises: 9111a79197ee
Create Date: 2026-09-28 09:50:01.310275

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "36996d3bd894"
down_revision: str | Sequence[str] | None = "9111a79197ee"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "product_variants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("weight_grams", sa.Integer(), nullable=False),
        sa.Column("packaging", sa.String(length=20), nullable=False),
        sa.Column("price", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("units_per_carton", sa.Integer(), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "packaging IN ('jar', 'tub', 'bucket', 'bag', 'box', 'sachet')",
            name=op.f("ck_product_variants_packaging_known"),
        ),
        sa.CheckConstraint("price >= 0", name=op.f("ck_product_variants_price_non_negative")),
        sa.CheckConstraint("stock >= 0", name=op.f("ck_product_variants_stock_non_negative")),
        sa.CheckConstraint("weight_grams > 0", name=op.f("ck_product_variants_weight_positive")),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("fk_product_variants_product_id_products"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_variants")),
        sa.UniqueConstraint("product_id", "weight_grams", "packaging", name="uq_variant_size"),
    )
    op.create_index(
        op.f("ix_product_variants_product_id"), "product_variants", ["product_id"], unique=False
    )
    op.add_column("order_items", sa.Column("variant_id", sa.Integer(), nullable=True))
    op.add_column("order_items", sa.Column("weight_grams", sa.Integer(), nullable=True))
    op.add_column("order_items", sa.Column("packaging", sa.String(length=20), nullable=True))
    op.create_index(op.f("ix_order_items_variant_id"), "order_items", ["variant_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_order_items_variant_id_product_variants"),
        "order_items",
        "product_variants",
        ["variant_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("products", sa.Column("brand", sa.String(length=80), nullable=True))
    op.add_column(
        "products", sa.Column("ingredients_en", sa.Text(), nullable=False, server_default="")
    )
    op.add_column(
        "products", sa.Column("ingredients_fr", sa.Text(), nullable=False, server_default="")
    )
    op.add_column("products", sa.Column("storage_en", sa.Text(), nullable=False, server_default=""))
    op.add_column("products", sa.Column("storage_fr", sa.Text(), nullable=False, server_default=""))
    op.add_column("products", sa.Column("shelf_life_months", sa.Integer(), nullable=True))
    # Data: every existing product becomes one size carrying its old price/weight/stock
    # (retail jar up to 1 kg, bucket above), and past order lines point at that size.
    op.execute(
        """
        INSERT INTO product_variants
            (product_id, weight_grams, packaging, price, stock, is_available, sort_order)
        SELECT id,
               COALESCE(weight_grams, 250),
               CASE WHEN COALESCE(weight_grams, 250) > 1000 THEN 'bucket' ELSE 'jar' END,
               price, stock, true, 0
        FROM products
        """
    )
    op.execute(
        """
        UPDATE order_items oi
        SET variant_id = v.id, weight_grams = v.weight_grams, packaging = v.packaging
        FROM product_variants v
        WHERE v.product_id = oi.product_id
        """
    )
    for col in ("ingredients_en", "ingredients_fr", "storage_en", "storage_fr"):
        op.alter_column("products", col, server_default=None)

    op.drop_constraint(op.f("ck_products_stock_non_negative"), "products", type_="check")
    op.drop_constraint(op.f("ck_products_price_non_negative"), "products", type_="check")
    op.drop_column("products", "stock")
    op.drop_column("products", "price")
    op.drop_column("products", "weight_grams")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "products", sa.Column("weight_grams", sa.INTEGER(), autoincrement=False, nullable=True)
    )
    op.add_column("products", sa.Column("price", sa.NUMERIC(precision=12, scale=3), nullable=True))
    op.add_column("products", sa.Column("stock", sa.INTEGER(), nullable=True))
    # Back to one price/stock per product: take each product's first size.
    op.execute(
        """
        UPDATE products p
        SET price = v.price, stock = v.stock, weight_grams = v.weight_grams
        FROM (
            SELECT DISTINCT ON (product_id) product_id, price, stock, weight_grams
            FROM product_variants
            ORDER BY product_id, sort_order, weight_grams
        ) v
        WHERE v.product_id = p.id
        """
    )
    op.execute("UPDATE products SET price = 0 WHERE price IS NULL")
    op.execute("UPDATE products SET stock = 0 WHERE stock IS NULL")
    op.alter_column("products", "price", nullable=False)
    op.alter_column("products", "stock", nullable=False)
    op.create_check_constraint(op.f("ck_products_stock_non_negative"), "products", "stock >= 0")
    op.create_check_constraint(op.f("ck_products_price_non_negative"), "products", "price >= 0")
    op.drop_column("products", "shelf_life_months")
    op.drop_column("products", "storage_fr")
    op.drop_column("products", "storage_en")
    op.drop_column("products", "ingredients_fr")
    op.drop_column("products", "ingredients_en")
    op.drop_column("products", "brand")
    op.drop_constraint(
        op.f("fk_order_items_variant_id_product_variants"), "order_items", type_="foreignkey"
    )
    op.drop_index(op.f("ix_order_items_variant_id"), table_name="order_items")
    op.drop_column("order_items", "packaging")
    op.drop_column("order_items", "weight_grams")
    op.drop_column("order_items", "variant_id")
    op.drop_index(op.f("ix_product_variants_product_id"), table_name="product_variants")
    op.drop_table("product_variants")
