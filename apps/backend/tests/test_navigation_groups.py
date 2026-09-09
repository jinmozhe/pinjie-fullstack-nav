import os
import uuid
from datetime import UTC, datetime

import pytest

from app.core.config import Settings
from app.core.exceptions import AppException
from app.core.request_metadata import RequestMetadata
from app.core.resources import create_resources
from app.db.models import NavCategory, NavSite, NavSiteAccount, NavTag
from app.services.navigation import NavigationService
from tests.conftest import TEST_SECRETS


@pytest.mark.integration
async def test_group_previews_name_domain_search_and_visibility_use_real_postgresql() -> None:
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
                        name=f"Draft-{marker}",
                        url="https://example.com",
                        category=public,
                        tags=[],
                        is_published=False,
                        is_pinned=True,
                    ),
                    NavSite(
                        name=f"Disabled-{marker}",
                        url="https://example.com",
                        category=disabled,
                        tags=[],
                        is_published=True,
                        is_pinned=True,
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
            assert [item.id for item in await service.taxonomy("tags", public=True, category_id=public.id)] == [tag.id]
            assert await service.taxonomy("tags", public=True, category_id=empty.id) == []
            with pytest.raises(AppException) as hidden_filter:
                await service.taxonomy("tags", public=True, category_id=private.id)
            assert hidden_filter.value.status_code == 404
            assert await service.taxonomy("tags", public=True, reader=True, category_id=private.id) == []
            assert [item.id for item in await service.taxonomy("categories", public=True, tag_id=tag.id)] == [public.id]
            with pytest.raises(AppException) as invalid_filter:
                await service.taxonomy("categories", public=True, category_id=public.id)
            assert invalid_filter.value.status_code == 400
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
            assert admin.total == 10
            assert {item.id for item in admin.items} == {item.id for item in sites}
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
            sites[1].is_pinned = sites[9].is_pinned = private_site.is_pinned = True
            await session.flush()
            pinned_first = await service.list_sites(
                page=1, page_size=1, search=marker, category_id=None, tag_id=None, public=True, pinned_only=True
            )
            pinned_second = await service.list_sites(
                page=2, page_size=1, search=marker, category_id=None, tag_id=None, public=True, pinned_only=True
            )
            assert pinned_first.total == pinned_second.total == 2
            assert [item.id for item in pinned_first.items] == [sites[1].id]
            assert [item.id for item in pinned_second.items] == [sites[9].id]
            pinned_reader = await service.list_sites(
                page=1,
                page_size=24,
                search=marker,
                category_id=None,
                tag_id=None,
                public=True,
                reader=True,
                pinned_only=True,
            )
            assert {item.id for item in pinned_reader.items} == {sites[1].id, sites[9].id, private_site.id}
            unchanged = await service.groups(page=1, page_size=12)
            assert next(item for item in unchanged.items if item.category.id == public.id) == group
            sites[9].deleted_at = datetime.now(UTC)
            sites[9].deleted_by_id = uuid.uuid7()
            sites[9].deleted_by_type = "admin"
            await session.flush()
            after_delete = await service.list_sites(
                page=1, page_size=24, search=marker, category_id=None, tag_id=None, public=True, pinned_only=True
            )
            assert after_delete.total == 1
            assert [item.id for item in after_delete.items] == [sites[1].id]

            # A name and a host match share one result set; URL paths are not hosts.
            domain = f"domain-{marker}.example.com"
            sites[0].url = f"HTTPS://Sub.{domain}:8443/docs"
            sites[1].name = domain
            sites[1].url = f"https://{domain}"
            sites[2].url = f"https://example.com/{domain}"
            sites[3].url = f"https://example.com?next={domain}"
            sites[4].url = f"https://example.com#{domain}"
            sites[9].url = f"https://{domain}"
            private_site.url = f"https://{domain}"
            description_only.description = domain
            session.add_all(
                [
                    NavSite(name="Draft domain", url=f"https://{domain}", category=public, tags=[], is_published=False),
                    NavSite(
                        name="Disabled domain", url=f"https://{domain}", category=disabled, tags=[], is_published=True
                    ),
                ]
            )
            await session.flush()
            for page_number, expected in [(1, sites[0]), (2, sites[1])]:
                domain_page = await service.list_sites(
                    page=page_number,
                    page_size=1,
                    search=f"  {domain.upper()}  ",
                    category_id=private.id,
                    tag_id=uuid.uuid7(),
                    public=True,
                )
                assert domain_page.total == 2
                assert [item.id for item in domain_page.items] == [expected.id]
            reader_domains = await service.list_sites(
                page=1, page_size=100, search=domain, category_id=None, tag_id=None, public=True, reader=True
            )
            assert reader_domains.total == 3
            assert {item.id for item in reader_domains.items} == {sites[0].id, sites[1].id, private_site.id}
            admin_domains = await service.list_sites(
                page=1, page_size=100, search=domain, category_id=public.id, tag_id=tag.id
            )
            assert admin_domains.total == 2
            assert {item.id for item in admin_domains.items} == {sites[0].id, sites[1].id}
            admin_without_tag = await service.list_sites(
                page=1, page_size=100, search=domain, category_id=public.id, tag_id=None
            )
            assert admin_without_tag.total == 3  # Includes the draft, excludes description-only matches.
            assert description_only.id not in {item.id for item in admin_without_tag.items}
            trash_domains = await service.list_sites(
                page=1, page_size=100, search=domain, category_id=public.id, tag_id=tag.id, deleted=True
            )
            assert trash_domains.total == 1
            assert [item.id for item in trash_domains.items] == [sites[9].id]

            sites[5].url = f"https://literal%_{marker}.example.com"
            sites[6].url = f"http://[2001:db8::{marker[:4]}]:8443/docs"
            await session.flush()
            for keyword, expected_ids in [
                (f"%_{marker}", {literal.id, sites[5].id}),
                (f"2001:db8::{marker[:4]}", {sites[6].id}),
                (f"https://{domain}", set()),
                (f"{domain}:8443", set()),
            ]:
                special = await service.list_sites(
                    page=1, page_size=100, search=keyword, category_id=None, tag_id=None, public=True
                )
                assert special.total == len(expected_ids)
                assert {item.id for item in special.items} == expected_ids
            await session.rollback()
    finally:
        await resources.close()
