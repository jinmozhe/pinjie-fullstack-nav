"""allow navigation sites without a category

Revision ID: 20260911_01
Revises: 20260908_01
Create Date: 2026-09-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260911_01"
down_revision: str | Sequence[str] | None = "20260908_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("nav_sites", "category_id", existing_type=sa.Uuid(), nullable=True)


def downgrade() -> None:
    raise NotImplementedError(
        "20260911_01 cannot safely restore NOT NULL while uncategorized sites exist; use a database restore or forward repair"
    )
