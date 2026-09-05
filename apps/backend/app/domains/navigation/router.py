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
    NavSiteIn,
    NavSitePage,
    NavSiteRead,
    NavTaxonomyIn,
    NavTaxonomyRead,
    PublicNavSitePage,
)

public_router = APIRouter(prefix="/navigation", tags=["公开导航"])
admin_router = APIRouter(prefix="/admin/navigation", tags=["导航管理"])
TaxonomyKind = Literal["categories", "tags"]
Page = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=100)]


@public_router.get("/taxonomy/{kind}", response_model=ResponseModel[list[NavTaxonomyRead]])
async def public_taxonomy(
    kind: TaxonomyKind, service: NavigationServiceDependency
) -> ResponseModel[list[NavTaxonomyRead]]:
    return success_response(data=await service.taxonomy(kind, public=True), request_id=current_request_id())


@public_router.get("/sites", response_model=ResponseModel[PublicNavSitePage])
async def public_sites(
    service: NavigationServiceDependency,
    page: Page = 1,
    page_size: PageSize = 24,
    search: Search = "",
    category_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
) -> ResponseModel[PublicNavSitePage]:
    data = await service.list_sites(
        page=page, page_size=page_size, search=search, category_id=category_id, tag_id=tag_id, public=True
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
    response_model=ResponseModel[list[NavTaxonomyRead]],
    dependencies=[Depends(require_permission(PermissionCode.NAVIGATION_READ))],
)
async def admin_taxonomy(
    kind: TaxonomyKind, service: AdminNavigationServiceDependency
) -> ResponseModel[list[NavTaxonomyRead]]:
    return success_response(data=await service.taxonomy(kind), request_id=current_request_id())


@admin_router.post(
    "/taxonomy/{kind}",
    response_model=ResponseModel[NavTaxonomyRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def create_taxonomy(
    kind: TaxonomyKind, payload: NavTaxonomyIn, service: AdminNavigationServiceDependency
) -> ResponseModel[NavTaxonomyRead]:
    return success_response(data=await service.save_taxonomy(kind, payload), request_id=current_request_id())


@admin_router.put(
    "/taxonomy/{kind}/{id}",
    response_model=ResponseModel[NavTaxonomyRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_WRITE))],
)
async def update_taxonomy(
    kind: TaxonomyKind, id: uuid.UUID, payload: NavTaxonomyIn, service: AdminNavigationServiceDependency
) -> ResponseModel[NavTaxonomyRead]:
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
