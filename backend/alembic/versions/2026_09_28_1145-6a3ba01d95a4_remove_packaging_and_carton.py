"""remove packaging and carton

Revision ID: 6a3ba01d95a4
Revises: 5db01629a352
Create Date: 2026-09-28 11:45:21.870676

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6a3ba01d95a4"
down_revision: str | Sequence[str] | None = "5db01629a352"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Sizes are identified by weight alone: drop packaging and units per carton."""
    bind = op.get_bind()
    clash = bind.execute(
        sa.text(
            "SELECT product_id, weight_grams FROM product_variants "
            "GROUP BY 1, 2 HAVING count(*) > 1 LIMIT 1"
        )
    ).first()
    if clash is not None:
        raise RuntimeError(
            f"Product {clash.product_id} has two sizes weighing {clash.weight_grams} g "
            "(different packaging). Delete or change one in the admin, then migrate again."
        )

    op.drop_constraint("uq_variant_size", "product_variants", type_="unique")
    op.drop_constraint(op.f("ck_product_variants_packaging_known"), "product_variants")
    op.drop_column("product_variants", "packaging")
    op.drop_column("product_variants", "units_per_carton")
    op.create_unique_constraint(
        "uq_variant_size", "product_variants", ["product_id", "weight_grams"]
    )
    # Past orders keep their weight; the packaging word goes.
    op.drop_column("order_items", "packaging")


def downgrade() -> None:
    """Bring the columns back; existing sizes come back as jars, cartons unknown."""
    op.add_column("order_items", sa.Column("packaging", sa.String(length=20), nullable=True))
    op.drop_constraint("uq_variant_size", "product_variants", type_="unique")
    op.add_column("product_variants", sa.Column("units_per_carton", sa.Integer(), nullable=True))
    op.add_column(
        "product_variants",
        sa.Column("packaging", sa.String(length=20), nullable=False, server_default="jar"),
    )
    op.alter_column("product_variants", "packaging", server_default=None)
    op.create_check_constraint(
        op.f("ck_product_variants_packaging_known"),
        "product_variants",
        "packaging IN ('jar', 'tub', 'bucket', 'bag', 'box', 'sachet')",
    )
    op.create_unique_constraint(
        "uq_variant_size", "product_variants", ["product_id", "weight_grams", "packaging"]
    )
