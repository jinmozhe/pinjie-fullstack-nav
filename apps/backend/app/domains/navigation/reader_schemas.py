import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Proof = Annotated[str, Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")]


class ReaderAuthorizeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge: Annotated[str, Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]+$")]
    state: Proof
    redirect_uri: Annotated[str, Field(max_length=500)]


class ReaderExchangeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: Proof
    verifier: Proof
    state: Proof
    redirect_uri: Annotated[str, Field(max_length=500)]


class ReaderAuthorizationRead(BaseModel):
    code: str


class ReaderIdentityRead(BaseModel):
    admin_id: uuid.UUID
    display_name: str
    expires_at: datetime


class ReaderConfigRead(BaseModel):
    callback_urls: list[str]
