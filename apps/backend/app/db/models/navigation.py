import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, String, Table, Text, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class NavCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "nav_categories"
    __table_args__ = (
        CheckConstraint(
            "icon_key IN ('code', 'book', 'tool', 'app', 'globe', 'cloud', 'database', 'api', "
            "'design', 'image', 'video', 'music', 'ai', 'chart', 'education', 'news', "
            "'community', 'shopping', 'game', 'security')",
            name="ck_nav_categories_icon_key",
        ),
        {"comment": "导航一级分类"},
    )
    name: Mapped[str] = mapped_column(String(100), unique=True)
    icon_key: Mapped[str | None] = mapped_column(String(32), comment="分类内置图标标识，空值使用默认图标")
    description: Mapped[str] = mapped_column(String(1000), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    requires_login: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), comment="仅管理员查阅登录后可见"
    )


class NavTag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "nav_tags"
    __table_args__ = {"comment": "导航标签"}
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(String(1000), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


nav_site_tags = Table(
    "nav_site_tags",
    Base.metadata,
    Column("site_id", ForeignKey("nav_sites.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("nav_tags.id", ondelete="CASCADE"), primary_key=True),
    comment="站点与标签多对多关联",
)


class NavSite(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "nav_sites"
    __table_args__ = (
        CheckConstraint(
            "(deleted_at IS NULL AND deleted_by_id IS NULL AND deleted_by_type IS NULL) OR "
            "(deleted_at IS NOT NULL AND deleted_by_id IS NOT NULL AND deleted_by_type = 'admin')",
            name="ck_nav_sites_delete_actor",
        ),
        {"comment": "导航站点与发布状态"},
    )
    name: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(2000))
    description: Mapped[str] = mapped_column(String(2000), default="")
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("nav_categories.id", ondelete="RESTRICT"), index=True
    )
    icon_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("assets.id", ondelete="RESTRICT"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), comment="在独立置顶页面展示，不影响首页排序"
    )
    category: Mapped[NavCategory | None] = relationship(lazy="raise")
    tags: Mapped[list[NavTag]] = relationship(secondary=nav_site_tags, lazy="raise")


class NavSiteAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "nav_site_accounts"
    __table_args__ = (
        CheckConstraint("length(username) + length(password) + length(notes) > 0", name="ck_nav_accounts_content"),
        {"comment": "统一外网帐号资料，密码按产品决策明文存储"},
    )
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("nav_sites.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(100), default="")
    username: Mapped[str] = mapped_column(String(500), default="")
    password: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
