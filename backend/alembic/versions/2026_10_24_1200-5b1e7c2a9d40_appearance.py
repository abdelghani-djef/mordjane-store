"""appearance

Revision ID: 5b1e7c2a9d40
Revises: 68d95594e6e2
Create Date: 2026-10-24 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5b1e7c2a9d40"
down_revision: str | Sequence[str] | None = "68d95594e6e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Storefront appearance settings: for now, the home page photo."""
    op.create_table(
        "appearance_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hero_image_path", sa.String(length=255), nullable=True),
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
        sa.CheckConstraint("id = 1", name=op.f("ck_appearance_settings_single_row")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appearance_settings")),
    )


def downgrade() -> None:
    op.drop_table("appearance_settings")
