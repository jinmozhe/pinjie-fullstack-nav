"""Navigation categories, tags, sites and plaintext external account records."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260906_02"
down_revision: str | None = "20260906_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for name, comment in [("nav_categories", "导航一级分类"), ("nav_tags", "导航标签")]:
        op.create_table(
            name,
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("name", sa.String(100), nullable=False, unique=True),
            sa.Column("description", sa.String(1000), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            comment=comment,
        )
    op.create_table(
        "nav_sites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("description", sa.String(2000), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("category_id", sa.Uuid(), sa.ForeignKey("nav_categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("icon_asset_id", sa.Uuid(), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True, comment="软删除时间，非空表示已进入回收站"),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True, comment="执行软删除的主体 ID"),
        sa.Column("deleted_by_type", sa.String(16), nullable=True, comment="执行软删除的主体类型"),
        sa.Column("deletion_reason", sa.String(100), nullable=True, comment="软删除原因，可为空"),
        sa.CheckConstraint(
            "(deleted_at IS NULL AND deleted_by_id IS NULL AND deleted_by_type IS NULL) OR "
            "(deleted_at IS NOT NULL AND deleted_by_id IS NOT NULL AND deleted_by_type = 'admin')",
            name="ck_nav_sites_delete_actor",
        ),
        comment="导航站点与发布状态",
    )
    for column in ["category_id", "icon_asset_id", "deleted_at"]:
        op.create_index("ix_nav_sites_" + column, "nav_sites", [column])
    op.create_table(
        "nav_site_tags",
        sa.Column("site_id", sa.Uuid(), sa.ForeignKey("nav_sites.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Uuid(), sa.ForeignKey("nav_tags.id", ondelete="CASCADE"), primary_key=True),
        comment="站点与标签多对多关联",
    )
    op.create_table(
        "nav_site_accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("site_id", sa.Uuid(), sa.ForeignKey("nav_sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("username", sa.String(500), nullable=False),
        sa.Column("password", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.CheckConstraint("length(username) + length(password) + length(notes) > 0", name="ck_nav_accounts_content"),
        comment="统一外网帐号资料，密码按产品决策明文存储",
    )
    op.create_index("ix_nav_site_accounts_site_id", "nav_site_accounts", ["site_id"])


def downgrade() -> None:
    op.drop_table("nav_site_accounts")
    op.drop_table("nav_site_tags")
    op.drop_table("nav_sites")
    op.drop_table("nav_tags")
    op.drop_table("nav_categories")
