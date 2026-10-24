"""appearance logo

Revision ID: 8c3f1d6e2b57
Revises: 5b1e7c2a9d40
Create Date: 2026-10-24 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c3f1d6e2b57"
down_revision: str | Sequence[str] | None = "5b1e7c2a9d40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """The shop's logo can be replaced from the admin panel too."""
    op.add_column(
        "appearance_settings", sa.Column("logo_image_path", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("appearance_settings", "logo_image_path")
