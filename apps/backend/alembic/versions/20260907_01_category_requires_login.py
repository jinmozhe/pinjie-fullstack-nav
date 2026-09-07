"""Restrict navigation categories to authenticated readers when configured."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260907_01"
down_revision: str | None = "20260906_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "nav_categories",
        sa.Column(
            "requires_login",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="仅管理员查阅登录后可见",
        ),
    )


def downgrade() -> None:
    raise RuntimeError("分类可见性配置不可丢弃；请保留字段并前向修复，禁止回退到不执行可见性过滤的应用")
