import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies import require_admin_csrf, require_permission
from app.api.navigation_dependencies import (
    AdminNavigationServiceDependency,
    CurrentReaderDependency,
    NavigationServiceDependency,
)
from app.core.context import current_request_id
from app.core.response import ResponseModel, success_response
from app.domains.admin.permissions import PermissionCode

from .schemas import (
    NavAccountIn,
    NavAccountRead,
    NavBulkIn,
    NavBulkRead,
    NavCategoryIn,
    NavCategoryRead,
    NavSiteIn,
    NavSitePage,
    NavSitePurgeIn,
    NavSiteRead,
    NavTaxonomyIn,
    NavTaxonomyRead,
    PublicNavSitePage,
)

public_router = APIRouter(prefix="/navigation", tags=["公开导航"])
admin_router = APIRouter(prefix="/admin/navigation", tags=["导航管理"])
reader_router = APIRouter(prefix="/nav-reader", tags=["导航查阅"])
TaxonomyRead = NavCategoryRead | NavTaxonomyRead
TaxonomyKind = Literal["categories", "tags"]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=100)]


@public_router.get("/taxonomy/{kind}", response_model=ResponseModel[list[TaxonomyRead]])
async def public_taxonomy(
    kind: TaxonomyKind, service: NavigationServiceDependency, response: Response
) -> ResponseModel[list[TaxonomyRead]]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.taxonomy(kind, public=True), request_id=current_request_id())


@public_router.get("/sites", response_model=ResponseModel[PublicNavSitePage])
async def public_sites(
    service: NavigationServiceDependency,
    response: Response,
    page: Page = 1,
    page_size: PageSize = 24,
    search: Search = "",
    category_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
) -> ResponseModel[PublicNavSitePage]:
    response.headers["Cache-Control"] = "no-store"
    data = await service.list_sites(
        page=page, page_size=page_size, search=search, category_id=category_id, tag_id=tag_id, public=True
    )
    return success_response(data=cast(PublicNavSitePage, data), request_id=current_request_id())


@reader_router.get(
    "/taxonomy/categories",
    response_model=ResponseModel[list[TaxonomyRead]],
    summary="查阅启用的全部导航分类",
    description="要求有效管理员查阅会话，包含仅登录可见分类。",
)
async def reader_categories(
    service: NavigationServiceDependency, current: CurrentReaderDependency, response: Response
) -> ResponseModel[list[TaxonomyRead]]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(
        data=await service.taxonomy("categories", public=True, reader=True), request_id=current_request_id()
    )


@reader_router.get(
    "/sites",
    response_model=ResponseModel[PublicNavSitePage],
    summary="查阅全部已发布导航站点",
    description="要求有效管理员查阅会话，包含仅登录可见分类下的站点；仍排除停用分类、未发布及已删除站点。",
)
async def reader_sites(
    service: NavigationServiceDependency,
    current: CurrentReaderDependency,
    response: Response,
    page: Page = 1,
    page_size: PageSize = 24,
    search: Search = "",
    category_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
) -> ResponseModel[PublicNavSitePage]:
    response.headers["Cache-Control"] = "no-store"
    data = await service.list_sites(
        page=page, page_size=page_size, search=search, category_id=category_id, tag_id=tag_id, public=True, reader=True
    )
    return success_response(data=cast(PublicNavSitePage, data), request_id=current_request_id())


@public_router.get("/sites/{site_id}/accounts", response_model=ResponseModel[list[NavAccountRead]])
async def reader_accounts(
    site_id: uuid.UUID, service: NavigationServiceDependency, current: CurrentReaderDependency, response: Response
) -> ResponseModel[list[NavAccountRead]]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.accounts(site_id, public=True), request_id=current_request_id())


@admin_router.get(
    "/taxonomy/{kind}",
    response_model=ResponseModel[list[TaxonomyRead]],
    dependencies=[Depends(require_permission(PermissionCode.NAVIGATION_READ))],
)
async def admin_taxonomy(
    kind: TaxonomyKind, service: AdminNavigationServiceDependency
) -> ResponseModel[list[TaxonomyRead]]:
    return success_response(data=await service.taxonomy(kind), request_id=current_request_id())


@admin_router.post(
    "/taxonomy/{kind}",
    response_model=ResponseModel[TaxonomyRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def create_taxonomy(
    kind: TaxonomyKind, payload: NavCategoryIn | NavTaxonomyIn, service: AdminNavigationServiceDependency
) -> ResponseModel[TaxonomyRead]:
    return success_response(data=await service.save_taxonomy(kind, payload), request_id=current_request_id())


@admin_router.put(
    "/taxonomy/{kind}/{id}",
    response_model=ResponseModel[TaxonomyRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def update_taxonomy(
    kind: TaxonomyKind, id: uuid.UUID, payload: NavCategoryIn | NavTaxonomyIn, service: AdminNavigationServiceDependency
) -> ResponseModel[TaxonomyRead]:
    return success_response(data=await service.save_taxonomy(kind, payload, id), request_id=current_request_id())


@admin_router.post(
    "/taxonomy/{kind}/bulk",
    response_model=ResponseModel[NavBulkRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def bulk_taxonomy(
    kind: TaxonomyKind, payload: NavBulkIn, service: AdminNavigationServiceDependency
) -> ResponseModel[NavBulkRead]:
    return success_response(data=await service.bulk_taxonomy(kind, payload), request_id=current_request_id())


@admin_router.get(
    "/sites",
    response_model=ResponseModel[NavSitePage],
    dependencies=[Depends(require_permission(PermissionCode.NAVIGATION_READ))],
)
async def admin_sites(
    service: AdminNavigationServiceDependency,
    page: Page = 1,
    page_size: PageSize = 20,
    search: Search = "",
    category_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
    deleted: bool = False,
) -> ResponseModel[NavSitePage]:
    data = await service.list_sites(
        page=page, page_size=page_size, search=search, category_id=category_id, tag_id=tag_id, deleted=deleted
    )
    return success_response(data=cast(NavSitePage, data), request_id=current_request_id())


@admin_router.post(
    "/sites",
    response_model=ResponseModel[NavSiteRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def create_site(payload: NavSiteIn, service: AdminNavigationServiceDependency) -> ResponseModel[NavSiteRead]:
    return success_response(data=await service.save_site(payload), request_id=current_request_id())


@admin_router.put(
    "/sites/{id}",
    response_model=ResponseModel[NavSiteRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def update_site(
    id: uuid.UUID, payload: NavSiteIn, service: AdminNavigationServiceDependency
) -> ResponseModel[NavSiteRead]:
    return success_response(data=await service.save_site(payload, id), request_id=current_request_id())


@admin_router.post(
    "/sites/bulk",
    response_model=ResponseModel[NavBulkRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def bulk_sites(payload: NavBulkIn, service: AdminNavigationServiceDependency) -> ResponseModel[NavBulkRead]:
    return success_response(data=await service.bulk_sites(payload), request_id=current_request_id())


@admin_router.post(
    "/sites/purge",
    response_model=ResponseModel[NavBulkRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_PURGE))],
    summary="永久删除回收站站点",
    description="原子删除 1 至 100 个回收站站点及所属帐号和标签关联，保留分类、标签、图标资产和审计。",
    responses={
        401: {"description": "未登录"},
        403: {"description": "无永久删除权限或 CSRF 校验失败"},
        404: {"description": "目标站点不存在"},
        409: {"description": "目标不在回收站或状态冲突，整批回滚"},
    },
)
async def purge_sites(payload: NavSitePurgeIn, service: AdminNavigationServiceDependency) -> ResponseModel[NavBulkRead]:
    return success_response(data=await service.purge_sites(payload), request_id=current_request_id())


@admin_router.get(
    "/sites/{site_id}/accounts",
    response_model=ResponseModel[list[NavAccountRead]],
    dependencies=[Depends(require_permission(PermissionCode.NAVIGATION_CREDENTIALS_READ))],
)
async def admin_accounts(
    site_id: uuid.UUID, service: AdminNavigationServiceDependency, response: Response
) -> ResponseModel[list[NavAccountRead]]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.accounts(site_id), request_id=current_request_id())


@admin_router.post(
    "/sites/{site_id}/accounts",
    response_model=ResponseModel[NavAccountRead],
    dependencies=[
        Depends(require_admin_csrf),
        Depends(require_permission(PermissionCode.NAVIGATION_CREDENTIALS_WRITE)),
    ],
)
async def create_account(
    site_id: uuid.UUID, payload: NavAccountIn, service: AdminNavigationServiceDependency, response: Response
) -> ResponseModel[NavAccountRead]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.save_account(site_id, payload), request_id=current_request_id())


@admin_router.put(
    "/sites/{site_id}/accounts/{id}",
    response_model=ResponseModel[NavAccountRead],
    dependencies=[
        Depends(require_admin_csrf),
        Depends(require_permission(PermissionCode.NAVIGATION_CREDENTIALS_WRITE)),
    ],
)
async def update_account(
    site_id: uuid.UUID,
    id: uuid.UUID,
    payload: NavAccountIn,
    service: AdminNavigationServiceDependency,
    response: Response,
) -> ResponseModel[NavAccountRead]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.save_account(site_id, payload, id), request_id=current_request_id())


@admin_router.post(
    "/sites/{site_id}/accounts/bulk",
    response_model=ResponseModel[NavBulkRead],
    dependencies=[
        Depends(require_admin_csrf),
        Depends(require_permission(PermissionCode.NAVIGATION_CREDENTIALS_WRITE)),
    ],
)
async def bulk_accounts(
    site_id: uuid.UUID, payload: NavBulkIn, service: AdminNavigationServiceDependency
) -> ResponseModel[NavBulkRead]:
    return success_response(data=await service.bulk_accounts(site_id, payload), request_id=current_request_id())
