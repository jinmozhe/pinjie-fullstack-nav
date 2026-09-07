import asyncio
import os
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import delete, select

from app.api.dependencies import CurrentAdmin, get_current_admin
from app.core.config import Settings
from app.core.exceptions import AppException
from app.core.request_metadata import RequestMetadata
from app.core.resources import AppResources, create_resources
from app.core.security import token_digest
from app.db.models import (
    Admin,
    AdminSession,
    Asset,
    AuditEvent,
    NavCategory,
    NavSite,
    NavSiteAccount,
    NavTag,
    nav_site_tags,
)
from app.db.repositories import SecurityRepository
from app.db.transaction import transaction_scope
from app.domains.navigation.schemas import NavBulkIn, NavSitePurgeIn
from app.main import create_app
from app.services.navigation import NavigationService
from tests.conftest import TEST_SECRETS


def test_purge_requires_bounded_unique_site_ids() -> None:
    site_id = uuid.uuid7()
    assert NavSitePurgeIn(ids=[site_id]).ids == [site_id]
    for ids in [[], [site_id, site_id], [uuid.uuid7() for _ in range(101)], ["invalid"]]:
        with pytest.raises(ValidationError):
            NavSitePurgeIn.model_validate({"ids": ids})
    with pytest.raises(ValidationError):
        NavSitePurgeIn.model_validate({"ids": [site_id], "action": "delete"})


@dataclass
class PurgeEnvironment:
    resources: AppResources
    app: FastAPI
    admin: Admin
    category_id: uuid.UUID
    tag_id: uuid.UUID
    asset_id: uuid.UUID
    site_ids: list[uuid.UUID]

    def service(self, session) -> NavigationService:
        return NavigationService(
            session=session,
            session_factory=self.resources.session_factory,
            metadata=RequestMetadata(str(uuid.uuid7()), str(uuid.uuid7()), "127.0.0.1", "purge-test", "test"),
            actor_id=self.admin.id,
        )


@pytest.fixture
async def purge_environment() -> AsyncIterator[PurgeEnvironment]:
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url or not os.getenv("TEST_REDIS_URL"):
        pytest.fail("Isolated PostgreSQL and Redis test configuration is required")
    settings = Settings(
        _env_file=None, ENVIRONMENT="test", DATABASE_URL=database_url, TEST_DATABASE_URL=database_url, **TEST_SECRETS
    )
    settings.validate_runtime()
    resources = create_resources(settings)
    admin_id, category_id, tag_id, asset_id = [uuid.uuid7() for _ in range(4)]
    site_ids = [uuid.uuid7() for _ in range(3)]
    try:
        async with resources.session_factory() as session, transaction_scope(session):
            admin = Admin(
                id=admin_id,
                username=f"purge-{admin_id.hex[:16]}",
                password_hash="unused-test-hash",
                is_active=True,
                is_superuser=True,
                credential_version=1,
                roles=[],
            )
            category = NavCategory(id=category_id, name=f"purge-category-{category_id}")
            tag = NavTag(id=tag_id, name=f"purge-tag-{tag_id}")
            asset = Asset(
                id=asset_id,
                uploader_type="admin",
                uploader_id=admin_id,
                storage_driver="local",
                file_key=f"test/{asset_id}.png",
                original_name="test.png",
                mime_type="image/png",
                file_size=1,
                file_hash=asset_id.hex * 2,
                url=f"/assets/{asset_id}.png",
                scene="navigation_icon",
            )
            session.add_all([admin, category, tag, asset])
            await session.flush()
            for index, site_id in enumerate(site_ids):
                session.add(
                    NavSite(
                        id=site_id,
                        name=f"purge-{index}",
                        url="https://example.com",
                        category_id=category_id,
                        icon_asset_id=asset_id,
                        tags=[tag],
                        deleted_at=datetime.now(UTC) if index < 2 else None,
                        deleted_by_id=admin_id if index < 2 else None,
                        deleted_by_type="admin" if index < 2 else None,
                    )
                )
            await session.flush()
            session.add_all([NavSiteAccount(site_id=site_id, password="purge-test-password") for site_id in site_ids])
        app = create_app(settings)
        app.state.resources = resources
        yield PurgeEnvironment(resources, app, admin, category_id, tag_id, asset_id, site_ids)
    finally:
        async with resources.session_factory() as session, transaction_scope(session):
            await session.execute(delete(NavSite).where(NavSite.id.in_(site_ids)))
            await session.execute(delete(NavTag).where(NavTag.id == tag_id))
            await session.execute(delete(NavCategory).where(NavCategory.id == category_id))
            await session.execute(delete(Asset).where(Asset.id == asset_id))
            await session.execute(delete(AuditEvent).where(AuditEvent.actor_id == admin_id))
            await session.execute(delete(Admin).where(Admin.id == admin_id))
        await resources.close()


@pytest.mark.integration
@pytest.mark.parametrize("count", [1, 2])
async def test_purge_deletes_rows_and_dependents_but_keeps_shared_records(purge_environment, count: int) -> None:
    env = purge_environment
    ids = env.site_ids[:count]
    async with env.resources.session_factory() as session:
        result = await env.service(session).purge_sites(NavSitePurgeIn(ids=ids))
        assert result.completed_count == count
    async with env.resources.session_factory() as session:
        assert not list(await session.scalars(select(NavSite.id).where(NavSite.id.in_(ids))))
        assert not list(await session.scalars(select(NavSiteAccount.id).where(NavSiteAccount.site_id.in_(ids))))
        assert not list(await session.scalars(select(nav_site_tags.c.site_id).where(nav_site_tags.c.site_id.in_(ids))))
        assert await session.get(NavCategory, env.category_id) is not None
        assert await session.get(NavTag, env.tag_id) is not None
        assert await session.get(Asset, env.asset_id) is not None
        assert await session.get(NavSite, env.site_ids[2]) is not None
        event = (
            await session.scalars(
                select(AuditEvent).where(
                    AuditEvent.actor_id == env.admin.id, AuditEvent.action == "navigation.sites.purge"
                )
            )
        ).one()
        assert event.result == "succeeded"
        assert event.changed_fields == {"target_ids": [str(id) for id in ids]}


@pytest.mark.integration
@pytest.mark.parametrize("other", ["active", "missing"])
async def test_invalid_batch_keeps_all_existing_sites(purge_environment, other: str) -> None:
    env = purge_environment
    second = env.site_ids[2] if other == "active" else uuid.uuid7()
    async with env.resources.session_factory() as session:
        with pytest.raises(AppException) as failure:
            await env.service(session).purge_sites(NavSitePurgeIn(ids=[env.site_ids[0], second]))
        assert failure.value.status_code == (409 if other == "active" else 404)
    async with env.resources.session_factory() as session:
        assert await session.get(NavSite, env.site_ids[0]) is not None
        assert await session.scalar(select(NavSiteAccount.id).where(NavSiteAccount.site_id == env.site_ids[0]))


@pytest.mark.integration
async def test_api_enforces_identity_csrf_and_separate_permission(purge_environment) -> None:
    env = purge_environment
    endpoint = "/api/v1/admin/navigation/sites/purge"
    csrf = "purge-test-csrf"
    _, _, _, admin_hmac = env.app.state.settings.authentication_secrets()
    current = CurrentAdmin(
        admin=env.admin,
        login_session=AdminSession(csrf_digest=token_digest(csrf, admin_hmac)),
        permissions=frozenset({"navigation:write"}),
    )
    async with AsyncClient(transport=ASGITransport(app=env.app), base_url="http://testserver") as browser:
        body = {"ids": [str(env.site_ids[0])]}
        assert (await browser.post(endpoint, json=body)).status_code == 401
        env.app.dependency_overrides[get_current_admin] = lambda: current
        assert (await browser.post(endpoint, json=body)).status_code == 403
        browser.cookies.set("pinjie_admin_csrf", csrf)
        headers = {"Origin": "http://localhost:3001", "X-CSRF-Token": csrf}
        assert (await browser.post(endpoint, headers=headers, json=body)).status_code == 403
        current = CurrentAdmin(
            admin=env.admin, login_session=current.login_session, permissions=frozenset({"navigation:purge"})
        )
        assert (await browser.post(endpoint, headers=headers, json={"ids": []})).status_code == 422
        response = await browser.post(endpoint, headers=headers, json=body)
        assert response.status_code == 200 and response.json()["data"]["completed_count"] == 1
        assert "purge-test-password" not in response.text
        assert (await browser.post(endpoint, headers=headers, json=body)).status_code == 404


@pytest.mark.integration
async def test_service_rechecks_revoked_permission(purge_environment) -> None:
    env = purge_environment
    async with env.resources.session_factory() as session, transaction_scope(session):
        actor = await session.get(Admin, env.admin.id)
        actor.is_superuser = False
    async with env.resources.session_factory() as session:
        with pytest.raises(AppException) as failure:
            await env.service(session).purge_sites(NavSitePurgeIn(ids=[env.site_ids[0]]))
        assert failure.value.status_code == 403
        assert await session.get(NavSite, env.site_ids[0]) is not None


@pytest.mark.integration
async def test_restore_and_purge_cannot_both_succeed(purge_environment) -> None:
    env = purge_environment

    async def purge():
        async with env.resources.session_factory() as session:
            return await env.service(session).purge_sites(NavSitePurgeIn(ids=[env.site_ids[0]]))

    async def restore():
        async with env.resources.session_factory() as session:
            return await env.service(session).bulk_sites(NavBulkIn(ids=[env.site_ids[0]], action="restore"))

    results = await asyncio.gather(purge(), restore(), return_exceptions=True)
    assert sum(isinstance(result, AppException) for result in results) == 1
    assert sum(not isinstance(result, BaseException) for result in results) == 1
    async with env.resources.session_factory() as session:
        site = await session.get(NavSite, env.site_ids[0])
        assert site is None or site.deleted_at is None


@pytest.mark.integration
async def test_audit_failure_rolls_back_deleted_sites_and_accounts(purge_environment, monkeypatch) -> None:
    env = purge_environment

    async def unavailable_audit(self, event_id, *, for_update=False):
        return None

    monkeypatch.setattr(SecurityRepository, "get_audit_event", unavailable_audit)
    async with env.resources.session_factory() as session:
        with pytest.raises(AppException) as failure:
            await env.service(session).purge_sites(NavSitePurgeIn(ids=env.site_ids[:2]))
        assert failure.value.status_code == 503
    async with env.resources.session_factory() as session:
        assert len(list(await session.scalars(select(NavSite.id).where(NavSite.id.in_(env.site_ids[:2]))))) == 2
        assert (
            len(
                list(
                    await session.scalars(select(NavSiteAccount.id).where(NavSiteAccount.site_id.in_(env.site_ids[:2])))
                )
            )
            == 2
        )
