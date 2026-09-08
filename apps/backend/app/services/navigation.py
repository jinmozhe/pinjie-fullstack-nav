import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import TypeVar, cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.exceptions import AppException
from app.core.request_metadata import RequestMetadata
from app.db.models import NavCategory, NavSite, NavSiteAccount, NavTag
from app.db.repositories.asset import AssetRepository
from app.db.repositories.identity import AdminRepository
from app.db.repositories.navigation import NavigationRepository, TaxonomyKind
from app.domains.admin.permissions import PermissionCode
from app.domains.navigation.schemas import (
    NavAccountIn,
    NavAccountRead,
    NavBulkIn,
    NavBulkRead,
    NavCategoryIn,
    NavCategoryRead,
    NavSiteGroupPage,
    NavSiteGroupRead,
    NavSiteIn,
    NavSitePage,
    NavSitePurgeIn,
    NavSiteRead,
    NavTaxonomyIn,
    NavTaxonomyRead,
    PublicNavSitePage,
    PublicNavSiteRead,
)
from app.services.security_events import AuditCoordinator

T = TypeVar("T")


def missing() -> AppException:
    return AppException(status_code=404, code="NAV_NOT_FOUND", message="导航资料不存在或不可见")


def conflict(message: str) -> AppException:
    return AppException(status_code=409, code="STATE_CONFLICT", message=message)


class NavigationService:
    def __init__(
        self,
        *,
        session: AsyncSession,
        session_factory: async_sessionmaker[AsyncSession],
        metadata: RequestMetadata,
        actor_id: uuid.UUID | None = None,
    ) -> None:
        self.session = session
        self.repo = NavigationRepository(session)
        self.session_factory = session_factory
        self.metadata = metadata
        self.actor_id = actor_id

    async def write(
        self, action: str, operation: Callable[[], Awaitable[T]], *, target_ids: list[uuid.UUID] | None = None
    ) -> T:
        if self.actor_id is None:
            raise AppException(status_code=403, code="AUTH_FORBIDDEN", message="需要管理员维护权限")

        async def authorized_operation() -> T:
            assert self.actor_id is not None
            actor = await AdminRepository(self.session).get(self.actor_id, for_update=True, refresh=True)
            if action == "sites.purge":
                permission = PermissionCode.NAVIGATION_PURGE
            elif action.startswith("accounts."):
                permission = PermissionCode.NAVIGATION_CREDENTIALS_WRITE
            else:
                permission = PermissionCode.NAVIGATION_WRITE
            if (
                actor is None
                or not actor.is_active
                or not (
                    actor.is_superuser
                    or any(
                        item.is_active and item.code == permission
                        for role in actor.roles
                        if role.is_active
                        for item in role.permissions
                    )
                )
            ):
                raise AppException(status_code=403, code="AUTH_FORBIDDEN", message="导航维护权限已失效")
            return await operation()

        try:
            return await AuditCoordinator(
                session=self.session,
                session_factory=self.session_factory,
                actor_id=self.actor_id,
                metadata=self.metadata,
            ).execute(
                action="navigation." + action,
                target_type="navigation",
                target_id=target_ids[0] if target_ids and len(target_ids) == 1 else None,
                changed_fields={"target_ids": [str(id) for id in target_ids or []]},
                operation=authorized_operation,
            )
        except IntegrityError as exc:
            raise conflict("名称已存在或资源被引用，请刷新后重试") from exc

    @staticmethod
    def taxonomy_read(row: NavCategory | NavTag) -> NavCategoryRead | NavTaxonomyRead:
        if isinstance(row, NavCategory):
            return NavCategoryRead.model_validate(row)
        return NavTaxonomyRead.model_validate(row)

    async def taxonomy(
        self, kind: TaxonomyKind, *, public: bool = False, reader: bool = False
    ) -> list[NavCategoryRead | NavTaxonomyRead]:
        return [self.taxonomy_read(item) for item in await self.repo.taxonomy(kind, public=public, reader=reader)]

    async def save_taxonomy(
        self, kind: TaxonomyKind, payload: NavCategoryIn | NavTaxonomyIn, id: uuid.UUID | None = None
    ) -> NavCategoryRead | NavTaxonomyRead:
        async def operation() -> NavCategoryRead | NavTaxonomyRead:
            if kind == "tags" and "requires_login" in payload.model_fields_set:
                raise conflict("标签不支持登录可见性设置")
            if kind == "tags" and "icon_key" in payload.model_fields_set:
                raise conflict("标签不支持分类图标")
            if id:
                rows = await self.repo.taxonomy_targets(kind, [id])
                if not rows:
                    raise missing()
                row = rows[0]
            else:
                row = NavCategory() if kind == "categories" else NavTag()
            for key, value in payload.model_dump(exclude={"requires_login", "icon_key"}).items():
                setattr(row, key, value)
            if isinstance(row, NavCategory):
                row.requires_login = payload.requires_login if isinstance(payload, NavCategoryIn) else False
                row.icon_key = payload.icon_key if isinstance(payload, NavCategoryIn) else None
            await self.repo.save(row)
            return self.taxonomy_read(row)

        return await self.write(kind + ".save", operation, target_ids=[id] if id else [])

    async def bulk_taxonomy(self, kind: TaxonomyKind, payload: NavBulkIn) -> NavBulkRead:
        async def operation() -> NavBulkRead:
            if payload.action not in {"enable", "disable", "delete"}:
                raise conflict("分类和标签不支持此操作")
            rows = await self.repo.taxonomy_targets(kind, payload.ids)
            if len(rows) != len(payload.ids):
                raise missing()
            for row in rows:
                if payload.action == "delete":
                    if kind == "categories" and await self.repo.category_used(row.id):
                        raise conflict("分类仍被站点引用，包含回收站站点")
                    await self.repo.delete(row)
                else:
                    row.is_active = payload.action == "enable"
            return NavBulkRead(completed_count=len(rows))

        return await self.write(kind + "." + payload.action, operation, target_ids=payload.ids)

    async def site(self, id: uuid.UUID, *, public: bool = False, lock: bool = False) -> NavSite:
        rows = await self.repo.site_targets([id], lock=lock)
        if not rows:
            raise missing()
        row = rows[0]
        if public and (row.deleted_at is not None or not row.is_published or not row.category.is_active):
            raise missing()
        return row

    @staticmethod
    def site_read(row: NavSite, icons: dict[uuid.UUID, str]) -> NavSiteRead:
        return NavSiteRead(
            id=row.id,
            name=row.name,
            url=row.url,
            description=row.description,
            category_id=row.category_id,
            tag_ids=[tag.id for tag in row.tags],
            icon_asset_id=row.icon_asset_id,
            sort_order=row.sort_order,
            is_published=row.is_published,
            category=NavCategoryRead.model_validate(row.category),
            tags=[NavTaxonomyRead.model_validate(tag) for tag in row.tags],
            icon_url=icons.get(row.icon_asset_id) if row.icon_asset_id else None,
            deleted_at=row.deleted_at,
            updated_at=row.updated_at,
        )

    async def list_sites(
        self,
        *,
        page: int,
        page_size: int,
        search: str,
        category_id: uuid.UUID | None,
        tag_id: uuid.UUID | None,
        public: bool = False,
        deleted: bool = False,
        reader: bool = False,
    ) -> NavSitePage | PublicNavSitePage:
        if public:
            search = search.strip()
            if search:
                category_id = tag_id = None
            for kind, id in [("categories", category_id), ("tags", tag_id)]:
                if id and not await self.repo.visible_taxonomy(cast(TaxonomyKind, kind), id, reader=reader):
                    raise missing()
        rows, total = await self.repo.sites(
            page=page,
            page_size=page_size,
            search=search,
            category_id=category_id,
            tag_id=tag_id,
            public=public,
            deleted=deleted,
            reader=reader,
        )
        icons = await self.repo.icons([row.icon_asset_id for row in rows if row.icon_asset_id])
        reads = [self.site_read(row, icons) for row in rows]
        if public:
            items = [self.public_read(row, icons) for row in rows]
            return PublicNavSitePage.create(items=items, page=page, page_size=page_size, total=total)
        return NavSitePage.create(items=reads, page=page, page_size=page_size, total=total)

    @staticmethod
    def public_read(row: NavSite, icons: dict[uuid.UUID, str]) -> PublicNavSiteRead:
        return PublicNavSiteRead(
            id=row.id,
            name=row.name,
            url=row.url,
            description=row.description,
            category=NavCategoryRead.model_validate(row.category),
            tags=[
                NavTaxonomyRead.model_validate(tag)
                for tag in sorted(row.tags, key=lambda tag: (tag.sort_order, tag.id))
                if tag.is_active
            ],
            icon_url=icons.get(row.icon_asset_id) if row.icon_asset_id else None,
        )

    async def groups(self, *, page: int, page_size: int, reader: bool = False) -> NavSiteGroupPage:
        rows, total = await self.repo.groups(page=page, page_size=page_size, reader=reader)
        icons = await self.repo.icons([row.icon_asset_id for row, _ in rows if row.icon_asset_id])
        groups: dict[uuid.UUID, NavSiteGroupRead] = {}
        for row, count in rows:
            if row.category_id not in groups:
                groups[row.category_id] = NavSiteGroupRead(
                    category=NavCategoryRead.model_validate(row.category), total=count, items=[]
                )
            groups[row.category_id].items.append(self.public_read(row, icons))
        return NavSiteGroupPage.create(items=list(groups.values()), page=page, page_size=page_size, total=total)

    async def public_site(self, id: uuid.UUID, *, reader: bool = False) -> PublicNavSiteRead:
        row = await self.site(id, public=True)
        if row.category.requires_login and not reader:
            raise missing()
        icons = await self.repo.icons([row.icon_asset_id] if row.icon_asset_id else [])
        return self.public_read(row, icons)

    async def save_site(self, payload: NavSiteIn, id: uuid.UUID | None = None) -> NavSiteRead:
        async def operation() -> NavSiteRead:
            categories = await self.repo.taxonomy_targets("categories", [payload.category_id])
            tags = await self.repo.taxonomy_targets("tags", payload.tag_ids)
            if not categories or len(tags) != len(payload.tag_ids):
                raise missing()
            if payload.icon_asset_id:
                asset = await AssetRepository(self.session).get(payload.icon_asset_id, for_update=True)
                if asset is None or asset.scene != "navigation_icon":
                    raise conflict("请选择导航图标场景的有效图片资产")
            row = await self.site(id, lock=True) if id else NavSite(tags=[])
            if row.deleted_at is not None:
                raise conflict("请先恢复回收站站点")
            for key, value in payload.model_dump(exclude={"tag_ids"}).items():
                setattr(row, key, value)
            row.category = cast(NavCategory, categories[0])
            row.tags = cast(list[NavTag], tags)
            await self.repo.save(row)
            return self.site_read(row, await self.repo.icons([row.icon_asset_id] if row.icon_asset_id else []))

        return await self.write("sites.save", operation, target_ids=[id] if id else [])

    async def bulk_sites(self, payload: NavBulkIn) -> NavBulkRead:
        async def operation() -> NavBulkRead:
            if payload.action not in {"publish", "unpublish", "delete", "restore"}:
                raise conflict("站点不支持此操作")
            rows = await self.repo.site_targets(payload.ids)
            if len(rows) != len(payload.ids):
                raise missing()
            for row in rows:
                if payload.action == "restore":
                    if row.deleted_at is None:
                        raise conflict("只有回收站站点可以恢复")
                    row.deleted_at = row.deleted_by_id = row.deleted_by_type = row.deletion_reason = None
                    row.is_published = False
                else:
                    if row.deleted_at is not None:
                        raise conflict("站点已在回收站")
                    row.is_published = payload.action == "publish"
                    if payload.action == "delete":
                        row.deleted_at, row.deleted_by_id, row.deleted_by_type = (
                            datetime.now(UTC),
                            self.actor_id,
                            "admin",
                        )
            return NavBulkRead(completed_count=len(rows))

        return await self.write("sites." + payload.action, operation, target_ids=payload.ids)

    async def purge_sites(self, payload: NavSitePurgeIn) -> NavBulkRead:
        async def operation() -> NavBulkRead:
            rows = await self.repo.site_targets(payload.ids)
            if len(rows) != len(payload.ids):
                raise missing()
            if any(row.deleted_at is None for row in rows):
                raise conflict("只有回收站站点可以永久删除，请刷新后重试")
            deleted_ids = await self.repo.purge_sites([row.id for row in rows])
            if set(deleted_ids) != set(payload.ids):
                raise conflict("站点状态已变化，永久删除未完成")
            return NavBulkRead(completed_count=len(deleted_ids))

        return await self.write("sites.purge", operation, target_ids=payload.ids)

    async def accounts(self, site_id: uuid.UUID, *, public: bool = False) -> list[NavAccountRead]:
        await self.site(site_id, public=public)
        return [NavAccountRead.model_validate(row) for row in await self.repo.accounts(site_id, public=public)]

    async def save_account(
        self, site_id: uuid.UUID, payload: NavAccountIn, id: uuid.UUID | None = None
    ) -> NavAccountRead:
        async def operation() -> NavAccountRead:
            site = await self.site(site_id, lock=True)
            if site.deleted_at is not None:
                raise conflict("请先恢复回收站站点")
            if id:
                rows = await self.repo.account_targets(site_id, [id])
                if not rows:
                    raise missing()
                row = rows[0]
            else:
                row = NavSiteAccount(site_id=site_id)
            for key, value in payload.model_dump().items():
                setattr(row, key, value)
            await self.repo.save(row)
            return NavAccountRead.model_validate(row)

        return await self.write("accounts.save", operation, target_ids=[id] if id else [site_id])

    async def bulk_accounts(self, site_id: uuid.UUID, payload: NavBulkIn) -> NavBulkRead:
        async def operation() -> NavBulkRead:
            await self.site(site_id, lock=True)
            if payload.action not in {"enable", "disable", "delete"}:
                raise conflict("帐号不支持此操作")
            rows = await self.repo.account_targets(site_id, payload.ids)
            if len(rows) != len(payload.ids):
                raise missing()
            for row in rows:
                if payload.action == "delete":
                    await self.repo.delete(row)
                else:
                    row.is_active = payload.action == "enable"
            return NavBulkRead(completed_count=len(rows))

        return await self.write("accounts." + payload.action, operation, target_ids=payload.ids)
