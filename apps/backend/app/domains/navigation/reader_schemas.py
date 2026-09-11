import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Proof = Annotated[str, Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")]


class ReaderAuthorizeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge: Annotated[
        str, Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]+$", description="授权挑战值")
    ]
    state: Annotated[str, Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9_-]+$", description="客户端状态值")]
    redirect_uri: Annotated[str, Field(max_length=500, description="授权完成后的回调地址")]


class ReaderExchangeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: Annotated[str, Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9_-]+$", description="一次性授权码")]
    verifier: Annotated[
        str, Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9_-]+$", description="客户端校验值")
    ]
    state: Annotated[str, Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9_-]+$", description="客户端状态值")]
    redirect_uri: Annotated[str, Field(max_length=500, description="授权完成后的回调地址")]


class ReaderAuthorizationRead(BaseModel):
    code: str = Field(description="一次性授权码")


class ReaderIdentityRead(BaseModel):
    admin_id: uuid.UUID = Field(description="管理员唯一标识")
    display_name: str = Field(description="管理员显示名称")
    expires_at: datetime = Field(description="查阅凭证过期时间")


class ReaderConfigRead(BaseModel):
    callback_urls: list[str] = Field(description="允许的导航查阅回调地址列表")
