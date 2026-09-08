import os
import uuid

import pytest

from app.core.config import Settings
from app.core.exceptions import AppException
from app.core.request_metadata import RequestMetadata
from app.core.resources import create_resources
from app.db.models import NavCategory, NavSite, NavSiteAccount, NavTag
from app.services.navigation import NavigationService
from tests.conftest import TEST_SECRETS


@pytest.mark.integration
async def test_group_previews_name_search_and_visibility_use_real_postgresql() -> None:
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url or not os.getenv("TEST_REDIS_URL"):
        pytest.fail("Isolated PostgreSQL and Redis test configuration is required")
    settings = Settings(
        _env_file=None, ENVIRONMENT="test", DATABASE_URL=database_url, TEST_DATABASE_URL=database_url, **TEST_SECRETS
    )
    settings.validate_runtime()
    resources = create_resources(settings)
    marker = uuid.uuid7().hex
    try:
        async with resources.session_factory() as session:
            public = NavCategory(name=f"public-{marker}", sort_order=-999999)
            private = NavCategory(name=f"private-{marker}", requires_login=True, sort_order=-999998)
            empty = NavCategory(name=f"empty-{marker}", sort_order=-999997)
            disabled = NavCategory(name=f"disabled-{marker}", is_active=False)
            tag = NavTag(name=f"tag-{marker}")
            session.add_all([public, private, empty, disabled, tag])
            await session.flush()
            sites = [
                NavSite(
                    name=f"Git-{marker}-{index}",
                    url="https://example.com",
                    category=public,
                    tags=[tag],
                    is_published=True,
                    sort_order=index,
                )
                for index in range(10)
            ]
            private_site = NavSite(
                name=f"Git-private-{marker}", url="https://example.com", category=private, tags=[], is_published=True
            )
            description_only = NavSite(
                name=f"Other-{marker}",
                description=f"Git-{marker}",
                url="https://example.com",
                category=public,
                tags=[],
                is_published=True,
                sort_order=20,
            )
            literal = NavSite(
                name=f"Literal%_{marker}",
                url="https://example.com",
                category=public,
                tags=[],
                is_published=True,
                sort_order=21,
            )
            session.add_all(
                [
                    *sites,
                    private_site,
                    description_only,
                    literal,
                    NavSite(
                        name=f"Draft-{marker}", url="https://example.com", category=public, tags=[], is_published=False
                    ),
                    NavSite(
                        name=f"Disabled-{marker}",
                        url="https://example.com",
                        category=disabled,
                        tags=[],
                        is_published=True,
                    ),
                ]
            )
            await session.flush()
            session.add(NavSiteAccount(site_id=sites[0].id, password="Sample-only-never-public"))
            await session.flush()
            service = NavigationService(
                session=session,
                session_factory=resources.session_factory,
                metadata=RequestMetadata(marker, marker, "127.0.0.1", "group-test", "test"),
            )
            page = await service.groups(page=1, page_size=12)
            group = next(item for item in page.items if item.category.id == public.id)
            assert group.total == 12
            assert [item.id for item in group.items] == [item.id for item in sites[:8]]
            assert not {private.id, empty.id, disabled.id} & {item.category.id for item in page.items}
            assert "Sample-only-never-public" not in page.model_dump_json()
            authorized = await service.groups(page=1, page_size=12, reader=True)
            assert private.id in {item.category.id for item in authorized.items}
            assert authorized.total == page.total + 1
            first = await service.groups(page=1, page_size=1, reader=True)
            second = await service.groups(page=2, page_size=1, reader=True)
            assert first.items[0].category.id == public.id
            assert second.items[0].category.id == private.id
            found = await service.list_sites(
                page=1,
                page_size=100,
                search=f"  gIT-{marker}  ",
                category_id=private.id,
                tag_id=uuid.uuid7(),
                public=True,
            )
            assert found.total == 10
            assert {item.id for item in found.items} == {item.id for item in sites}
            admin = await service.list_sites(
                page=1, page_size=100, search=f"Git-{marker}", category_id=public.id, tag_id=None
            )
            assert admin.total == 11
            escaped = await service.list_sites(
                page=1, page_size=100, search=f"%_{marker}", category_id=None, tag_id=None, public=True
            )
            assert [item.id for item in escaped.items] == [literal.id]
            no_sites = await service.list_sites(
                page=1, page_size=24, search="", category_id=empty.id, tag_id=None, public=True
            )
            assert no_sites.total == 0
            with pytest.raises(AppException) as hidden:
                await service.list_sites(
                    page=1, page_size=24, search="", category_id=private.id, tag_id=None, public=True
                )
            assert hidden.value.status_code == 404
            with pytest.raises(AppException):
                await service.public_site(private_site.id)
            assert (await service.public_site(private_site.id, reader=True)).id == private_site.id
            assert "password" not in (await service.public_site(sites[0].id)).model_dump()
            await session.rollback()
    finally:
        await resources.close()
