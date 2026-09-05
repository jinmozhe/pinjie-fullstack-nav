import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import delete, select

from app.core.config import Settings
from app.core.exceptions import AppException
from app.core.payload_sanitizer import is_sensitive_route
from app.core.request_metadata import RequestMetadata
from app.core.resources import create_resources
from app.db.models import (
    Admin,
    AdminSession,
    AuditEvent,
    NavAuthorizationCode,
    NavCategory,
    NavReaderSession,
    NavSite,
    NavSiteAccount,
    NavTag,
    SecurityLoginEvent,
)
from app.db.transaction import transaction_scope
from app.domains.admin.schemas import AdminLoginIn
from app.domains.navigation.reader_schemas import ReaderAuthorizeIn, ReaderExchangeIn
from app.domains.navigation.schemas import NavAccountIn, NavBulkIn, NavSiteIn, NavTaxonomyIn
from app.main import create_app
from app.services.authentication import AdminAuthService
from app.services.nav_reader import NavReaderService, pkce_challenge, require_reader_permission
from app.services.navigation import NavigationService
from tests.conftest import TEST_SECRETS


def test_password_is_preserved_and_notes_only_is_valid() -> None:
    assert NavAccountIn(password="  public-test-password\n ").password == "  public-test-password\n "
    assert NavAccountIn(notes="Example note").username == ""
    with pytest.raises(ValidationError):
        NavAccountIn()
    with pytest.raises(ValidationError):
        NavAccountIn(username="sample", user_id=str(uuid.uuid7()))


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "ftp://example.com",
        "https://u:p@example.com",
        "https://example.com:bad",
        "https://example.com\\@other.example",
    ],
)
def test_site_rejects_unsafe_urls(url: str) -> None:
    with pytest.raises(ValidationError):
        NavSiteIn(name="sample", url=url, category_id=uuid.uuid7())


def test_pkce_uses_rfc7636_s256_vector() -> None:
    assert (
        pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    )


def test_disabled_superuser_cannot_read_credentials() -> None:
    with pytest.raises(AppException):
        require_reader_permission(Admin(is_superuser=True, is_active=False, roles=[]))
    with pytest.raises(AppException):
        require_reader_permission(Admin(is_superuser=False, is_active=True, roles=[]))


def test_bulk_rejects_duplicate_ids_and_sensitive_routes_hide_all_input() -> None:
    id = uuid.uuid7()
    with pytest.raises(ValidationError):
        NavBulkIn(ids=[id, id], action="delete")
    for route in ["/api/v1/admin/navigation/sites/{site_id}/accounts", "/api/v1/nav-reader/exchange"]:
        assert is_sensitive_route(route)


@pytest.mark.integration
async def test_real_navigation_lifecycle_and_reader_isolation() -> None:
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url or not os.getenv("TEST_REDIS_URL"):
        pytest.fail("Isolated PostgreSQL and Redis test configuration is required")
    settings = Settings(
        _env_file=None, ENVIRONMENT="test", DATABASE_URL=database_url, TEST_DATABASE_URL=database_url, **TEST_SECRETS
    )
    settings.validate_runtime()
    resources = create_resources(settings)
    admin_id = uuid.uuid7()
    category_id = tag_id = site_id = None
    metadata = RequestMetadata(str(uuid.uuid7()), str(uuid.uuid7()), "127.0.0.1", "navigation-test", "test")
    try:
        async with resources.session_factory() as session:
            async with transaction_scope(session):
                admin = Admin(
                    id=admin_id,
                    username=f"nav-{admin_id.hex[:16]}",
                    password_hash=await resources.password_manager.hash("Sample-Only-Password-42!"),
                    is_active=True,
                    is_superuser=True,
                    credential_version=1,
                    roles=[],
                )
                session.add(admin)
            service = NavigationService(
                session=session, session_factory=resources.session_factory, metadata=metadata, actor_id=admin_id
            )
            category = await service.save_taxonomy("categories", NavTaxonomyIn(name=f"category-{admin_id}"))
            category_id = category.id
            tag = await service.save_taxonomy("tags", NavTaxonomyIn(name=f"tag-{admin_id}"))
            tag_id = tag.id
            site = await service.save_site(
                NavSiteIn(
                    name="Example",
                    url="https://example.com",
                    category_id=category.id,
                    tag_ids=[tag.id],
                    is_published=True,
                )
            )
            site_id = site.id
            account = await service.save_account(site.id, NavAccountIn(password=" sample-test-value "))
            app = create_app(settings)
            app.state.resources = resources
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as browser:
                denied = await browser.get(f"/api/v1/navigation/sites/{site.id}/accounts")
                assert denied.status_code == 401
                assert account.password not in denied.text
            assert (await service.accounts(site.id, public=True))[0].password == account.password
            public = await service.list_sites(
                page=1, page_size=100, search="", category_id=category.id, tag_id=None, public=True
            )
            assert account.password not in public.model_dump_json()
            with pytest.raises(AppException):
                await service.bulk_taxonomy("categories", NavBulkIn(ids=[category.id], action="delete"))
            with pytest.raises(AppException):
                await service.bulk_sites(NavBulkIn(ids=[site.id, uuid.uuid7()], action="delete"))
            assert (await service.accounts(site.id, public=True))[0].id == account.id
            await service.bulk_sites(NavBulkIn(ids=[site.id], action="delete"))
            with pytest.raises(AppException):
                await service.accounts(site.id, public=True)
            assert len(await service.accounts(site.id)) == 1
            await service.bulk_sites(NavBulkIn(ids=[site.id], action="restore"))
            with pytest.raises(AppException):
                await service.accounts(site.id, public=True)
            await service.bulk_sites(NavBulkIn(ids=[site.id], action="publish"))
            await service.bulk_taxonomy("categories", NavBulkIn(ids=[category.id], action="disable"))
            session.expire_all()
            with pytest.raises(AppException):
                await service.accounts(site.id, public=True)
        async with resources.session_factory() as session:
            admin = (await session.scalars(select(Admin).where(Admin.id == admin_id))).one()
            reader = NavReaderService(
                session=session, session_factory=resources.session_factory, settings=settings, metadata=metadata
            )
            verifier = "a" * 43
            request = ReaderAuthorizeIn(
                challenge=pkce_challenge(verifier),
                state="s" * 43,
                redirect_uri="http://localhost:3000/navigation/callback",
            )
            with pytest.raises(AppException):
                await reader.authorize(
                    admin, request.model_copy(update={"redirect_uri": "https://other.example/navigation/callback"})
                )
            code = await reader.authorize(admin, request)
            exchange = ReaderExchangeIn(
                code=code, verifier=verifier, state=request.state, redirect_uri=request.redirect_uri
            )
            for field, value in [("verifier", "b" * 43), ("state", "t" * 43)]:
                with pytest.raises(AppException):
                    await reader.exchange(exchange.model_copy(update={field: value}))
            token, csrf, identity = await reader.exchange(exchange)
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as browser:
                browser.cookies.set("pinjie_reader_session", token)
                denied = await browser.post(
                    "/api/v1/admin/navigation/sites/bulk",
                    headers={"Origin": "http://localhost:3000"},
                    json={"ids": [str(site_id)], "action": "delete"},
                )
                assert denied.status_code in {401, 403}
            with pytest.raises(AppException):
                await reader.exchange(exchange)
            assert (await reader.current(token))[0].id == identity.admin_id
            auth = AdminAuthService(
                session=session,
                session_factory=resources.session_factory,
                redis=resources.redis,
                settings=settings,
                password_manager=resources.password_manager,
                metadata=metadata,
            )
            _, admin_session = await auth.login(
                AdminLoginIn(username=admin.username, password="Sample-Only-Password-42!")
            )
            await auth.logout(admin_session.refresh_token, admin_session.csrf_token)
            assert (await reader.current(token))[0].id == admin_id
            _, active_admin_session = await auth.login(
                AdminLoginIn(username=admin.username, password="Sample-Only-Password-42!")
            )
            with pytest.raises(AppException):
                await reader.logout(token, "invalid-csrf")
            assert (await reader.current(token))[0].id == admin_id
            await reader.logout(token, csrf)
            unchanged_admin_session = await session.get(AdminSession, active_admin_session.session_id)
            assert unchanged_admin_session is not None and unchanged_admin_session.revoked_at is None
            with pytest.raises(AppException):
                await reader.current(token)
        async with resources.session_factory() as session:
            admin = (await session.scalars(select(Admin).where(Admin.id == admin_id))).one()
            reader = NavReaderService(
                session=session, session_factory=resources.session_factory, settings=settings, metadata=metadata
            )
            code = await reader.authorize(admin, request)
            token, _, _ = await reader.exchange(exchange.model_copy(update={"code": code}))
            async with transaction_scope(session):
                admin.credential_version += 1
            with pytest.raises(AppException):
                await reader.current(token)
            code = await reader.authorize(admin, request)
            async with transaction_scope(session):
                row = (
                    await session.scalars(
                        select(NavAuthorizationCode).where(NavAuthorizationCode.code_digest == reader.digest(code))
                    )
                ).one()
                row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            with pytest.raises(AppException):
                await reader.exchange(exchange.model_copy(update={"code": code}))
    finally:
        async with resources.session_factory() as session, transaction_scope(session):
            if site_id:
                await session.execute(delete(NavSiteAccount).where(NavSiteAccount.site_id == site_id))
                await session.execute(delete(NavSite).where(NavSite.id == site_id))
            if tag_id:
                await session.execute(delete(NavTag).where(NavTag.id == tag_id))
            if category_id:
                await session.execute(delete(NavCategory).where(NavCategory.id == category_id))
            await session.execute(delete(NavReaderSession).where(NavReaderSession.admin_id == admin_id))
            await session.execute(delete(NavAuthorizationCode).where(NavAuthorizationCode.admin_id == admin_id))
            await session.execute(delete(AuditEvent).where(AuditEvent.actor_id == admin_id))
            await session.execute(delete(SecurityLoginEvent).where(SecurityLoginEvent.principal_id == admin_id))
            await session.execute(delete(AdminSession).where(AdminSession.admin_id == admin_id))
            await session.execute(delete(Admin).where(Admin.id == admin_id))
        await resources.close()
