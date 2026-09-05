"""Independent navigation authorization codes and reader sessions."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260906_01"
down_revision: str | None = "20260829_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "nav_authorization_codes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("admin_id", sa.Uuid(), sa.ForeignKey("admins.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("credential_version", sa.Integer(), nullable=False),
        sa.Column("challenge", sa.String(43), nullable=False),
        sa.Column("state", sa.String(128), nullable=False),
        sa.Column("redirect_uri", sa.String(500), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        comment="导航查阅一次性授权码，仅保存摘要",
    )
    op.create_index("ix_nav_authorization_codes_expires_at", "nav_authorization_codes", ["expires_at"])
    op.create_table(
        "nav_reader_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("token_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("csrf_digest", sa.String(64), nullable=False),
        sa.Column("admin_id", sa.Uuid(), sa.ForeignKey("admins.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("credential_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        comment="独立于管理端登录会话的导航只读会话",
    )
    op.create_index("ix_nav_reader_sessions_admin_id", "nav_reader_sessions", ["admin_id"])
    op.create_index("ix_nav_reader_sessions_expires_at", "nav_reader_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_table("nav_reader_sessions")
    op.drop_table("nav_authorization_codes")
