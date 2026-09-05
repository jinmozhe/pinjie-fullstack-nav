import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.exceptions import AppException
from app.core.request_metadata import RequestMetadata
from app.core.security import token_digest
from app.db.models import Admin, NavAuthorizationCode, NavReaderSession
from app.db.repositories.identity import AdminRepository
from app.db.repositories.nav_reader import NavReaderRepository
from app.db.transaction import transaction_scope
from app.domains.admin.permissions import PermissionCode
from app.domains.navigation.reader_schemas import ReaderAuthorizeIn, ReaderExchangeIn, ReaderIdentityRead
from app.services.security_events import AuditCoordinator

READER_COOKIE = "pinjie_reader_session"
READER_CSRF_COOKIE = "pinjie_reader_csrf"


def pkce_challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")


def require_reader_permission(admin: Admin) -> None:
    allowed = admin.is_superuser or any(
        permission.is_active and permission.code == PermissionCode.NAVIGATION_CREDENTIALS_READ
        for role in admin.roles
        if role.is_active
        for permission in role.permissions
    )
    if not admin.is_active or not allowed:
        raise AppException(status_code=403, code="AUTH_FORBIDDEN", message="没有导航凭据查阅权限")


class NavReaderService:
    def __init__(
        self,
        *,
        session: AsyncSession,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        metadata: RequestMetadata,
    ) -> None:
        self.session = session
        self.settings = settings
        self.session_factory = session_factory
        self.metadata = metadata
        self.repo = NavReaderRepository(session)

    def digest(self, value: str) -> str:
        _, _, key, _ = self.settings.authentication_secrets()
        return token_digest("nav-reader:" + value, key)

    def check_redirect(self, redirect_uri: str) -> None:
        if redirect_uri not in {origin + "/navigation/callback" for origin in self.settings.web_origins}:
            raise AppException(status_code=400, code="NAV_CALLBACK_INVALID", message="导航登录回调地址不匹配")

    async def authorize(self, admin: Admin, payload: ReaderAuthorizeIn) -> str:
        self.check_redirect(payload.redirect_uri)
        require_reader_permission(admin)
        code = secrets.token_urlsafe(32)

        async def operation() -> str:
            current = await AdminRepository(self.session).get(admin.id, for_update=True, refresh=True)
            if current is None:
                raise AppException(status_code=401, code="AUTH_REQUIRED", message="管理员身份已失效")
            require_reader_permission(current)
            await self.repo.add(
                NavAuthorizationCode(
                    code_digest=self.digest(code),
                    admin_id=admin.id,
                    credential_version=admin.credential_version,
                    challenge=payload.challenge,
                    state=payload.state,
                    redirect_uri=payload.redirect_uri,
                    expires_at=datetime.now(UTC) + timedelta(seconds=60),
                    consumed_at=None,
                )
            )
            return code

        return await AuditCoordinator(
            session=self.session,
            session_factory=self.session_factory,
            actor_id=admin.id,
            metadata=self.metadata,
        ).execute(
            action="navigation.reader.authorize",
            target_type="admin",
            target_id=admin.id,
            changed_fields={},
            operation=operation,
        )

    async def exchange(self, payload: ReaderExchangeIn) -> tuple[str, str, ReaderIdentityRead]:
        self.check_redirect(payload.redirect_uri)
        async with transaction_scope(self.session):
            code = await self.repo.code(self.digest(payload.code))
            now = datetime.now(UTC)
            if (
                code is None
                or code.consumed_at is not None
                or code.expires_at <= now
                or not hmac.compare_digest(code.state, payload.state)
                or not hmac.compare_digest(code.challenge, pkce_challenge(payload.verifier))
                or code.redirect_uri != payload.redirect_uri
            ):
                raise AppException(status_code=401, code="NAV_AUTHORIZATION_INVALID", message="导航登录已过期或无效")
            admin = await AdminRepository(self.session).get(code.admin_id, refresh=True)
            if admin is None or admin.credential_version != code.credential_version:
                raise AppException(status_code=401, code="AUTH_SESSION_REVOKED", message="管理员身份已失效")
            require_reader_permission(admin)
            code.consumed_at = now
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            reader = NavReaderSession(
                token_digest=self.digest(token),
                csrf_digest=self.digest(csrf),
                admin_id=admin.id,
                credential_version=admin.credential_version,
                created_at=now,
                expires_at=now + timedelta(seconds=self.settings.nav_reader_ttl_seconds),
                revoked_at=None,
            )
            await self.repo.add(reader)
            return token, csrf, self.identity(admin, reader)

    async def current(self, token: str | None) -> tuple[Admin, NavReaderSession]:
        reader = await self.repo.reader(self.digest(token)) if token and len(token) <= 128 else None
        if reader is None or reader.revoked_at is not None or reader.expires_at <= datetime.now(UTC):
            raise AppException(status_code=401, code="AUTH_REQUIRED", message="请登录管理员帐号查阅")
        admin = await AdminRepository(self.session).get(reader.admin_id, refresh=True)
        if admin is None or admin.credential_version != reader.credential_version:
            raise AppException(status_code=401, code="AUTH_SESSION_REVOKED", message="查阅会话已失效")
        require_reader_permission(admin)
        return admin, reader

    @staticmethod
    def identity(admin: Admin, reader: NavReaderSession) -> ReaderIdentityRead:
        return ReaderIdentityRead(
            admin_id=admin.id, display_name=admin.display_name or admin.username, expires_at=reader.expires_at
        )

    async def logout(self, token: str | None, csrf: str | None) -> None:
        async with transaction_scope(self.session):
            reader = await self.repo.reader(self.digest(token), lock=True) if token else None
            if reader is None:
                return
            if not csrf or not hmac.compare_digest(reader.csrf_digest, self.digest(csrf)):
                raise AppException(status_code=403, code="CSRF_REJECTED", message="CSRF 校验失败")
            reader.revoked_at = datetime.now(UTC)
