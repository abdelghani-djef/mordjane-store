"""email notifications

Revision ID: 957a2d6d7ee6
Revises: 36996d3bd894
Create Date: 2026-09-28 10:39:58.587897

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "957a2d6d7ee6"
down_revision: str | Sequence[str] | None = "36996d3bd894"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "notification_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("admin_recipients", postgresql.ARRAY(sa.String(length=254)), nullable=False),
        sa.Column("admin_language", sa.String(length=2), nullable=False),
        sa.Column("notify_admin_new_order", sa.Boolean(), nullable=False),
        sa.Column("notify_admin_status_change", sa.Boolean(), nullable=False),
        sa.Column("notify_admin_low_stock", sa.Boolean(), nullable=False),
        sa.Column("low_stock_threshold", sa.Integer(), nullable=False),
        sa.Column("notify_customer_confirmation", sa.Boolean(), nullable=False),
        sa.Column("notify_customer_validated", sa.Boolean(), nullable=False),
        sa.Column("notify_customer_shipped", sa.Boolean(), nullable=False),
        sa.Column("notify_customer_delivered", sa.Boolean(), nullable=False),
        sa.Column("notify_customer_cancelled", sa.Boolean(), nullable=False),
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
            "admin_language IN ('en', 'fr')",
            name=op.f("ck_notification_settings_admin_language_known"),
        ),
        sa.CheckConstraint("id = 1", name=op.f("ck_notification_settings_single_row")),
        sa.CheckConstraint(
            "low_stock_threshold >= 0", name=op.f("ck_notification_settings_threshold_non_negative")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_settings")),
    )
    op.add_column(
        "orders", sa.Column("locale", sa.String(length=2), server_default="fr", nullable=False)
    )
    # The single settings row, with the defaults the shop used before this migration.
    op.execute(
        """
        INSERT INTO notification_settings (
            id, admin_recipients, admin_language,
            notify_admin_new_order, notify_admin_status_change, notify_admin_low_stock,
            low_stock_threshold,
            notify_customer_confirmation, notify_customer_validated, notify_customer_shipped,
            notify_customer_delivered, notify_customer_cancelled
        ) VALUES (1, '{}', 'fr', true, true, true, 5, true, false, false, true, true)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("orders", "locale")
    op.drop_table("notification_settings")
