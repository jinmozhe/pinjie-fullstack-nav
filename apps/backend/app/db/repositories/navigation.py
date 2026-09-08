import uuid
from typing import Literal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import Asset, NavCategory, NavSite, NavSiteAccount, NavTag

TaxonomyKind = Literal["categories", "tags"]


class NavigationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def visible_sites(*, reader: bool) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = [
            NavSite.deleted_at.is_(None),
            NavSite.is_published.is_(True),
            NavCategory.is_active.is_(True),
        ]
        if not reader:
            conditions.append(NavCategory.requires_login.is_(False))
        return conditions

    async def visible_taxonomy(self, kind: TaxonomyKind, id: uuid.UUID, *, reader: bool) -> bool:
        if kind == "categories":
            query = select(NavCategory.id).where(NavCategory.id == id, NavCategory.is_active)
            if not reader:
                query = query.where(NavCategory.requires_login.is_(False))
        else:
            query = select(NavTag.id).where(NavTag.id == id, NavTag.is_active)
        return await self.session.scalar(query) is not None

    async def groups(self, *, page: int, page_size: int, reader: bool) -> tuple[list[tuple[NavSite, int]], int]:
        visible = self.visible_sites(reader=reader)
        populated = select(NavSite.category_id).join(NavCategory).where(*visible).distinct()
        total = await self.session.scalar(select(func.count()).select_from(populated.subquery()))
        categories = (
            select(NavCategory.id)
            .where(NavCategory.id.in_(populated))
            .order_by(NavCategory.sort_order, NavCategory.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        # Rank and count before limiting previews so totals cover the entire visible category.
        ranked = (
            select(
                NavSite.id,
                func.count().over(partition_by=NavSite.category_id).label("site_total"),
                func.row_number()
                .over(partition_by=NavSite.category_id, order_by=(NavSite.sort_order, NavSite.id))
                .label("position"),
            )
            .join(NavCategory)
            .where(*visible, NavSite.category_id.in_(categories))
            .subquery()
        )
        query = (
            select(NavSite, ranked.c.site_total)
            .join(ranked, ranked.c.id == NavSite.id)
            .join(NavCategory)
            .where(ranked.c.position <= 8)
            .options(selectinload(NavSite.category), selectinload(NavSite.tags))
            .order_by(NavCategory.sort_order, NavCategory.id, NavSite.sort_order, NavSite.id)
        )
        rows = await self.session.execute(query)
        return [(row, int(count)) for row, count in rows], int(total or 0)

    async def taxonomy(
        self, kind: TaxonomyKind, *, public: bool = False, reader: bool = False
    ) -> list[NavCategory] | list[NavTag]:
        if kind == "categories":
            query = select(NavCategory).order_by(NavCategory.sort_order, NavCategory.id)
            if public and not reader:
                query = query.where(NavCategory.requires_login.is_(False))
            return list(await self.session.scalars(query.where(NavCategory.is_active) if public else query))
        tags = select(NavTag).order_by(NavTag.sort_order, NavTag.id)
        return list(await self.session.scalars(tags.where(NavTag.is_active) if public else tags))

    async def taxonomy_targets(self, kind: TaxonomyKind, ids: list[uuid.UUID]) -> list[NavCategory] | list[NavTag]:
        if kind == "categories":
            return list(
                await self.session.scalars(
                    select(NavCategory).where(NavCategory.id.in_(ids)).order_by(NavCategory.id).with_for_update()
                )
            )
        return list(
            await self.session.scalars(select(NavTag).where(NavTag.id.in_(ids)).order_by(NavTag.id).with_for_update())
        )

    async def category_used(self, id: uuid.UUID) -> bool:
        return await self.session.scalar(select(NavSite.id).where(NavSite.category_id == id).limit(1)) is not None

    async def sites(
        self,
        *,
        page: int,
        page_size: int,
        search: str,
        category_id: uuid.UUID | None,
        tag_id: uuid.UUID | None,
        public: bool,
        deleted: bool,
        reader: bool = False,
    ) -> tuple[list[NavSite], int]:
        query = select(NavSite).join(NavCategory).options(selectinload(NavSite.category), selectinload(NavSite.tags))
        query = query.where(NavSite.deleted_at.is_not(None) if deleted and not public else NavSite.deleted_at.is_(None))
        if public:
            query = query.where(*self.visible_sites(reader=reader))
        if search:
            pattern = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            name_matches = NavSite.name.ilike(pattern, escape="\\")
            query = query.where(
                name_matches if public else name_matches | NavSite.description.ilike(pattern, escape="\\")
            )
        if category_id:
            query = query.where(NavSite.category_id == category_id)
        if tag_id:
            query = query.where(NavSite.tags.any(NavTag.id == tag_id))
        total = await self.session.scalar(select(func.count()).select_from(query.subquery()))
        rows = await self.session.scalars(
            query.order_by(NavSite.sort_order, NavSite.id).offset((page - 1) * page_size).limit(page_size)
        )
        return list(rows), int(total or 0)

    async def site_targets(self, ids: list[uuid.UUID], *, lock: bool = True) -> list[NavSite]:
        query = (
            select(NavSite)
            .where(NavSite.id.in_(ids))
            .order_by(NavSite.id)
            .options(selectinload(NavSite.category), selectinload(NavSite.tags))
        )
        return list(
            await self.session.scalars(
                query.with_for_update().execution_options(populate_existing=True) if lock else query
            )
        )

    async def icons(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
        return {asset.id: asset.url for asset in await self.session.scalars(select(Asset).where(Asset.id.in_(ids)))}

    async def purge_sites(self, ids: list[uuid.UUID]) -> list[uuid.UUID]:
        # Foreign keys cascade to accounts and tag links, preserving shared assets and taxonomy.
        return list(
            await self.session.scalars(
                delete(NavSite)
                .where(NavSite.id.in_(ids), NavSite.deleted_at.is_not(None))
                .returning(NavSite.id)
                .execution_options(synchronize_session="fetch")
            )
        )

    async def accounts(self, site_id: uuid.UUID, *, public: bool = False) -> list[NavSiteAccount]:
        query = select(NavSiteAccount).where(NavSiteAccount.site_id == site_id)
        if public:
            query = query.where(NavSiteAccount.is_active)
        return list(await self.session.scalars(query.order_by(NavSiteAccount.sort_order, NavSiteAccount.id)))

    async def account_targets(self, site_id: uuid.UUID, ids: list[uuid.UUID]) -> list[NavSiteAccount]:
        return list(
            await self.session.scalars(
                select(NavSiteAccount)
                .where(NavSiteAccount.site_id == site_id, NavSiteAccount.id.in_(ids))
                .order_by(NavSiteAccount.id)
                .with_for_update()
            )
        )

    async def save(self, value: NavCategory | NavTag | NavSite | NavSiteAccount) -> None:
        self.session.add(value)
        await self.session.flush()

    async def delete(self, value: NavCategory | NavTag | NavSiteAccount) -> None:
        await self.session.delete(value)
        await self.session.flush()
