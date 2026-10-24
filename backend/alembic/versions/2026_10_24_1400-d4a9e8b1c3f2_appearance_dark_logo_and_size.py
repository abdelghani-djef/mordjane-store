"""appearance dark logo and size

Revision ID: d4a9e8b1c3f2
Revises: 8c3f1d6e2b57
Create Date: 2026-10-24 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4a9e8b1c3f2"
down_revision: str | Sequence[str] | None = "8c3f1d6e2b57"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """A second logo for the dark theme, and how tall the logo shows."""
    op.add_column(
        "appearance_settings",
        sa.Column("logo_dark_image_path", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "appearance_settings",
        sa.Column("logo_height", sa.Integer(), server_default="40", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_appearance_settings_logo_height_range"),
        "appearance_settings",
        "logo_height BETWEEN 24 AND 96",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_appearance_settings_logo_height_range"), "appearance_settings", type_="check"
    )
    op.drop_column("appearance_settings", "logo_height")
    op.drop_column("appearance_settings", "logo_dark_image_path")
