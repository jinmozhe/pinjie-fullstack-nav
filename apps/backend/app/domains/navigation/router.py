import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies import require_admin_csrf, require_permission
from app.api.navigation_dependencies import (
    AdminNavigationServiceDependency,
    CurrentReaderDependency,
    NavigationMetadataServiceDependency,
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
    NavMetadataIn,
    NavMetadataRead,
    NavSiteGroupPage,
    NavSiteIn,
    NavSitePage,
    NavSitePurgeIn,
    NavSiteRead,
    NavTaxonomyResult,
    NavTaxonomyWrite,
    PublicNavSitePage,
    PublicNavSiteRead,
)

public_router = APIRouter(prefix="/navigation", tags=["公开导航"])
admin_router = APIRouter(prefix="/admin/navigation", tags=["导航管理"])
reader_router = APIRouter(prefix="/nav-reader", tags=["导航查阅"])
TaxonomyRead = NavTaxonomyResult
TaxonomyKind = Literal["categories", "tags"]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=100)]
GroupPageSize = Annotated[int, Query(ge=1, le=12)]


@public_router.get(
    "/groups",
    response_model=ResponseModel[NavSiteGroupPage],
    summary="按分类读取公开站点预览",
    description="分页读取有公开站点的启用分类，每组最多八个站点，total 为可见非空分类数。",
)
async def public_groups(
    service: NavigationServiceDependency,
    response: Response,
    page: Page = 1,
    page_size: GroupPageSize = 6,
) -> ResponseModel[NavSiteGroupPage]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.groups(page=page, page_size=page_size), request_id=current_request_id())


@reader_router.get(
    "/groups",
    response_model=ResponseModel[NavSiteGroupPage],
    summary="按分类查阅站点预览",
    description="要求有效管理员查阅会话，包含仅登录可见分类，每组最多八个站点，不返回帐号。",
    responses={401: {"description": "查阅会话无效"}, 403: {"description": "无查阅权限"}},
)
async def reader_groups(
    service: NavigationServiceDependency,
    current: CurrentReaderDependency,
    response: Response,
    page: Page = 1,
    page_size: GroupPageSize = 6,
) -> ResponseModel[NavSiteGroupPage]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(
        data=await service.groups(page=page, page_size=page_size, reader=True), request_id=current_request_id()
    )


@public_router.get(
    "/sites/{site_id}",
    response_model=ResponseModel[PublicNavSiteRead],
    summary="读取公开站点详情",
    description="仅返回已发布且分类公开启用的站点资料，不含帐号。",
    responses={404: {"description": "站点不存在或不可见"}},
)
async def public_site(
    site_id: uuid.UUID,
    service: NavigationServiceDependency,
    response: Response,
) -> ResponseModel[PublicNavSiteRead]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.public_site(site_id), request_id=current_request_id())


@reader_router.get(
    "/sites/{site_id}",
    response_model=ResponseModel[PublicNavSiteRead],
    summary="查阅站点详情",
    description="要求有效管理员查阅会话，包含登录可见分类，不含帐号。",
    responses={
        401: {"description": "查阅会话无效"},
        403: {"description": "无查阅权限"},
        404: {"description": "站点不存在或不可见"},
    },
)
async def reader_site(
    site_id: uuid.UUID,
    service: NavigationServiceDependency,
    current: CurrentReaderDependency,
    response: Response,
) -> ResponseModel[PublicNavSiteRead]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.public_site(site_id, reader=True), request_id=current_request_id())


@public_router.get(
    "/taxonomy/{kind}",
    response_model=ResponseModel[list[TaxonomyRead]],
    summary="读取公开分类或标签",
    description="tags 可用 category_id 查询分类内标签；categories 可用 tag_id 查询标签所属分类。仅统计公开可见站点。",
    responses={400: {"description": "筛选参数不匹配"}, 404: {"description": "筛选目标不存在或不可见"}},
)
async def public_taxonomy(
    kind: TaxonomyKind,
    service: NavigationServiceDependency,
    response: Response,
    category_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
) -> ResponseModel[list[TaxonomyRead]]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(
        data=await service.taxonomy(kind, public=True, category_id=category_id, tag_id=tag_id),
        request_id=current_request_id(),
    )


@public_router.get(
    "/sites",
    response_model=ResponseModel[PublicNavSitePage],
    summary="搜索和筛选公开站点",
    description="search 去除首尾空白后仅按名称包含匹配，忽略大小写及分类标签条件；无搜索时可按分类标签筛选。",
    responses={404: {"description": "筛选目标不存在或不可见"}},
)
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
    summary="查阅启用的导航分类",
    description="要求有效管理员查阅会话，包含仅登录可见分类。可传 tag_id 只返回包含该标签站点的分类。",
)
async def reader_categories(
    service: NavigationServiceDependency,
    current: CurrentReaderDependency,
    response: Response,
    tag_id: uuid.UUID | None = None,
) -> ResponseModel[list[TaxonomyRead]]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(
        data=await service.taxonomy("categories", public=True, reader=True, tag_id=tag_id),
        request_id=current_request_id(),
    )


@reader_router.get(
    "/taxonomy/tags",
    response_model=ResponseModel[list[TaxonomyRead]],
    summary="查阅分类内的导航标签",
    description="要求有效管理员查阅会话；可用 category_id 查询可见分类内已发布站点的启用标签。",
    responses={
        401: {"description": "查阅会话无效"},
        403: {"description": "无查阅权限"},
        404: {"description": "筛选目标不存在或不可见"},
    },
)
async def reader_tags(
    service: NavigationServiceDependency,
    current: CurrentReaderDependency,
    response: Response,
    category_id: uuid.UUID | None = None,
) -> ResponseModel[list[TaxonomyRead]]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(
        data=await service.taxonomy("tags", public=True, reader=True, category_id=category_id),
        request_id=current_request_id(),
    )


@reader_router.get(
    "/sites",
    response_model=ResponseModel[PublicNavSitePage],
    summary="查阅全部已发布导航站点",
    description="要求有效管理员查阅会话，包含登录可见分类；search 仅按名称包含匹配并忽略分类标签条件，排除停用分类、未发布及已删除站点。",
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


@admin_router.post(
    "/metadata",
    response_model=ResponseModel[NavMetadataRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
    summary="按网址抓取站点资料草稿",
    description="仅抓取标准端口公网页面，返回名称、简介、PNG 图标与缺失提示；不执行脚本、不保存站点或资产。",
    responses={
        401: {"description": "未登录"},
        403: {"description": "无维护权限或 CSRF 无效"},
        422: {"description": "网址或目标不允许"},
        429: {"description": "抓取并发已满"},
        502: {"description": "目标网页不可读取"},
        504: {"description": "抓取超时"},
    },
)
async def fetch_metadata(
    payload: NavMetadataIn,
    service: NavigationMetadataServiceDependency,
    response: Response,
) -> ResponseModel[NavMetadataRead]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=await service.fetch(payload.url), request_id=current_request_id())


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
    kind: TaxonomyKind, payload: NavTaxonomyWrite, service: AdminNavigationServiceDependency
) -> ResponseModel[TaxonomyRead]:
    return success_response(data=await service.save_taxonomy(kind, payload), request_id=current_request_id())


@admin_router.put(
    "/taxonomy/{kind}/{id}",
    response_model=ResponseModel[TaxonomyRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def update_taxonomy(
    kind: TaxonomyKind, id: uuid.UUID, payload: NavTaxonomyWrite, service: AdminNavigationServiceDependency
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
