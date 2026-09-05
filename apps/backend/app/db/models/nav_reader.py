import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, UUIDPrimaryKeyMixin


class NavAuthorizationCode(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "nav_authorization_codes"
    __table_args__ = {"comment": "导航查阅一次性授权码，仅保存摘要"}

    code_digest: Mapped[str] = mapped_column(String(64), unique=True)
    admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admins.id", ondelete="RESTRICT"))
    credential_version: Mapped[int] = mapped_column(Integer)
    challenge: Mapped[str] = mapped_column(String(43))
    state: Mapped[str] = mapped_column(String(128))
    redirect_uri: Mapped[str] = mapped_column(String(500))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NavReaderSession(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "nav_reader_sessions"
    __table_args__ = {"comment": "独立于管理端登录会话的导航只读会话"}

    token_digest: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_digest: Mapped[str] = mapped_column(String(64))
    admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admins.id", ondelete="RESTRICT"), index=True)
    credential_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
