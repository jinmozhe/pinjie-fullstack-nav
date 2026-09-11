import uuid
from datetime import datetime
from typing import Annotated, Any, Literal, Self
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.pagination import PageResult

Name = Annotated[str, Field(min_length=1, max_length=100, description="名称，长度为 1 至 100 个字符")]
CategoryIconKey = Literal[
    "code",
    "book",
    "tool",
    "app",
    "globe",
    "cloud",
    "database",
    "api",
    "design",
    "image",
    "video",
    "music",
    "ai",
    "chart",
    "education",
    "news",
    "community",
    "shopping",
    "game",
    "security",
]


class NavTaxonomyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    description: str = Field(default="", max_length=1000, description="分类或标签描述")
    sort_order: int = Field(default=0, ge=-1000000, le=1000000, description="显示排序值，数值越小越靠前")
    is_active: bool = Field(default=True, description="是否启用")

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("名称不能为空")
        return value.strip()


class NavTaxonomyRead(NavTaxonomyIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class NavCategoryIn(NavTaxonomyIn):
    requires_login: bool = Field(default=False, description="仅管理员查阅登录后可见")
    icon_key: CategoryIconKey | None = Field(default=None, description="分类内置图标标识，null 使用默认图标")


class NavCategoryRead(NavTaxonomyRead):
    requires_login: bool = Field(description="仅管理员查阅登录后可见")
    icon_key: CategoryIconKey | None = Field(default=None, description="分类内置图标标识，null 使用默认图标")


def _taxonomy_common_schema(base: type[BaseModel]) -> dict[str, Any]:
    # Keep inherited object guarantees visible alongside the category/tag alternatives.
    return {key: value for key, value in base.model_json_schema().items() if key in {"type", "properties", "required"}}


type NavTaxonomyWrite = Annotated[
    NavCategoryIn | NavTaxonomyIn, Field(json_schema_extra=_taxonomy_common_schema(NavTaxonomyIn))
]
type NavTaxonomyResult = Annotated[
    NavCategoryRead | NavTaxonomyRead, Field(json_schema_extra=_taxonomy_common_schema(NavTaxonomyRead))
]


class NavSiteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    url: str = Field(min_length=1, max_length=2000, description="不带登录信息的 HTTP 或 HTTPS 网址")
    description: str = Field(default="", max_length=2000, description="站点描述")
    category_id: uuid.UUID | None = Field(default=None, description="所属分类唯一标识，未分类时为空")
    tag_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100, description="关联标签唯一标识列表")
    icon_asset_id: uuid.UUID | None = Field(default=None, description="站点图标资产唯一标识")
    sort_order: int = Field(default=0, ge=-1000000, le=1000000, description="显示排序值，数值越小越靠前")
    is_published: bool = Field(default=False, description="是否在公开导航中发布")
    is_pinned: bool = Field(default=False, description="是否在独立置顶页面展示，不影响首页排序")

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return NavTaxonomyIn.clean_name(value)

    @field_validator("url")
    @classmethod
    def safe_url(cls, value: str) -> str:
        value = value.strip()
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError("网址必须为不带登录信息的 HTTP 或 HTTPS 地址")
        _ = parsed.port
        if any(ord(char) < 32 for char in value) or "\\" in value:
            raise ValueError("网址包含非法字符")
        return value

    @field_validator("tag_ids")
    @classmethod
    def unique_tags(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("标签不能重复")
        return value


class NavSiteRead(NavSiteIn):
    id: uuid.UUID
    category_id: uuid.UUID | None = Field(..., description="所属分类唯一标识，未分类时为空")
    category: NavCategoryRead | None = Field(..., description="所属分类详情，未分类时为空")
    tags: list[NavTaxonomyRead] = Field(description="关联标签详情列表")
    icon_url: str | None = Field(description="站点图标公开地址")
    deleted_at: datetime | None = Field(description="移入回收站的时间，未删除时为空")
    updated_at: datetime = Field(description="最近更新时间")


class NavMetadataIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=2000, description="待抓取的公网 HTTP(S) 网址")

    @field_validator("url")
    @classmethod
    def safe_url(cls, value: str) -> str:
        return NavSiteIn.safe_url(value)


class NavMetadataRead(BaseModel):
    name: str | None = Field(default=None, max_length=100, description="抓取到的站点名称")
    description: str | None = Field(default=None, max_length=2000, description="抓取到的站点描述")
    icon_base64: str | None = Field(
        default=None, max_length=400000, description="经校验缩放的 PNG Base64，保存前只在表单内存中使用"
    )
    warnings: list[str] = Field(default_factory=list, max_length=6, description="缺失或未完成字段的安全提示")


class PublicNavSiteRead(BaseModel):
    id: uuid.UUID = Field(description="站点唯一标识")
    name: str = Field(description="站点名称")
    url: str = Field(description="站点网址")
    description: str = Field(description="站点描述")
    category: NavCategoryRead = Field(description="所属分类详情")
    tags: list[NavTaxonomyRead] = Field(description="关联标签详情列表")
    icon_url: str | None = Field(description="站点图标公开地址")


class NavSiteGroupRead(BaseModel):
    category: NavCategoryRead = Field(description="分组所属分类详情")
    total: int = Field(ge=1, description="当前身份可见的分类站点总数")
    items: list[PublicNavSiteRead] = Field(max_length=8, description="按站点排序的最多八项预览")


class NavAccountIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str = Field(default="", max_length=100, description="帐号标签")
    username: str = Field(default="", max_length=500, description="登录用户名")
    password: str = Field(default="", max_length=10000, description="登录密码")
    notes: str = Field(default="", max_length=10000, description="帐号备注")
    sort_order: int = Field(default=0, ge=-1000000, le=1000000, description="帐号排序值，数值越小越靠前")
    is_active: bool = Field(default=True, description="帐号是否启用")

    @model_validator(mode="after")
    def require_content(self) -> Self:
        if not (self.username or self.password or self.notes):
            raise ValueError("用户名、密码或备注至少填写一项")
        return self


class NavAccountRead(NavAccountIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    site_id: uuid.UUID = Field(description="所属站点唯一标识")
    updated_at: datetime = Field(description="最近更新时间")


class NavBulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[uuid.UUID] = Field(min_length=1, max_length=100, description="待批量操作的目标唯一标识列表")
    action: Literal["enable", "disable", "delete", "restore", "publish", "unpublish"] = Field(
        description="批量操作类型"
    )

    @field_validator("ids")
    @classmethod
    def unique_ids(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("目标不能重复")
        return value


class NavBulkRead(BaseModel):
    completed_count: int = Field(description="本次批量操作完成的目标数量")


class NavSitePurgeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[uuid.UUID] = Field(min_length=1, max_length=100, description="待永久删除的回收站站点 ID")

    @field_validator("ids")
    @classmethod
    def unique_ids(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("目标不能重复")
        return value


NavSitePage = PageResult[NavSiteRead]
PublicNavSitePage = PageResult[PublicNavSiteRead]
NavSiteGroupPage = PageResult[NavSiteGroupRead]
