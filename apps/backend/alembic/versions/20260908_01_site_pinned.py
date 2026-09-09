"""Add independent navigation site pin state."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260908_01"
down_revision: str | None = "20260907_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "nav_sites",
        sa.Column(
            "is_pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="在独立置顶页面展示，不影响首页排序",
        ),
    )


def downgrade() -> None:
    raise RuntimeError("站点置顶配置不可丢弃；请保留字段并前向修复")
