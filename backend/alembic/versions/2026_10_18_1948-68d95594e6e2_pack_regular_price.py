"""pack regular price

Revision ID: 68d95594e6e2
Revises: 3acf19330f47
Create Date: 2026-10-18 19:48:23.331702

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "68d95594e6e2"
down_revision: str | Sequence[str] | None = "3acf19330f47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Packs get their own "instead of" price instead of computing it from the items."""
    op.add_column("packs", sa.Column("regular_price", sa.Numeric(precision=12, scale=3)))
    # Existing packs keep what they showed: the items bought separately (or just above the pack
    # price, if the items have become cheaper than the pack).
    op.execute(
        """
        UPDATE packs SET regular_price = GREATEST(
            packs.price + 0.001,
            (SELECT COALESCE(SUM(v.price * i.quantity), 0)
             FROM pack_items i JOIN product_variants v ON v.id = i.variant_id
             WHERE i.pack_id = packs.id)
        )
        """
    )
    op.alter_column("packs", "regular_price", nullable=False)
    op.create_check_constraint(
        op.f("ck_packs_price_below_regular"), "packs", "price < regular_price"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_packs_price_below_regular"), "packs", type_="check")
    op.drop_column("packs", "regular_price")
