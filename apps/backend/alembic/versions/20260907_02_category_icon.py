"""Add optional built-in icons to navigation categories."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260907_02"
down_revision: str | None = "20260907_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "nav_categories",
        sa.Column("icon_key", sa.String(32), nullable=True, comment="分类内置图标标识，空值使用默认图标"),
    )
    op.create_check_constraint(
        "ck_nav_categories_icon_key",
        "nav_categories",
        "icon_key IN ('code', 'book', 'tool', 'app', 'globe', 'cloud', 'database', 'api', "
        "'design', 'image', 'video', 'music', 'ai', 'chart', 'education', 'news', "
        "'community', 'shopping', 'game', 'security')",
    )


def downgrade() -> None:
    raise RuntimeError("分类图标配置不可丢弃；请保留字段并前向修复")
