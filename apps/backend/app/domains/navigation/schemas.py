import uuid
from datetime import datetime
from typing import Annotated, Literal, Self
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.pagination import PageResult

Name = Annotated[str, Field(min_length=1, max_length=100)]


class NavTaxonomyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    description: str = Field(default="", max_length=1000)
    sort_order: int = Field(default=0, ge=-1000000, le=1000000)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("名称不能为空")
        return value.strip()


class NavTaxonomyRead(NavTaxonomyIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class NavSiteIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    url: str = Field(min_length=1, max_length=2000)
    description: str = Field(default="", max_length=2000)
    category_id: uuid.UUID
    tag_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    icon_asset_id: uuid.UUID | None = None
    sort_order: int = Field(default=0, ge=-1000000, le=1000000)
    is_published: bool = False

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
    category: NavTaxonomyRead
    tags: list[NavTaxonomyRead]
    icon_url: str | None
    deleted_at: datetime | None
    updated_at: datetime


class PublicNavSiteRead(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    description: str
    category: NavTaxonomyRead
    tags: list[NavTaxonomyRead]
    icon_url: str | None


class NavAccountIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str = Field(default="", max_length=100)
    username: str = Field(default="", max_length=500)
    password: str = Field(default="", max_length=10000)
    notes: str = Field(default="", max_length=10000)
    sort_order: int = Field(default=0, ge=-1000000, le=1000000)
    is_active: bool = True

    @model_validator(mode="after")
    def require_content(self) -> Self:
        if not (self.username or self.password or self.notes):
            raise ValueError("用户名、密码或备注至少填写一项")
        return self


class NavAccountRead(NavAccountIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    site_id: uuid.UUID
    updated_at: datetime


class NavBulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[uuid.UUID] = Field(min_length=1, max_length=100)
    action: Literal["enable", "disable", "delete", "restore", "publish", "unpublish"]

    @field_validator("ids")
    @classmethod
    def unique_ids(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("目标不能重复")
        return value


class NavBulkRead(BaseModel):
    completed_count: int


NavSitePage = PageResult[NavSiteRead]
PublicNavSitePage = PageResult[PublicNavSiteRead]
