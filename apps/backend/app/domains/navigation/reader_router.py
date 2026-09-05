from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.api.dependencies import (
    CurrentAdmin,
    get_current_admin,
    get_request_settings,
    require_admin_csrf,
    require_permission,
    require_web_origin,
)
from app.api.navigation_dependencies import CurrentReaderDependency, ReaderServiceDependency
from app.core.context import current_request_id
from app.core.response import ResponseModel, success_response
from app.domains.admin.permissions import PermissionCode
from app.services.nav_reader import READER_COOKIE, READER_CSRF_COOKIE

from .reader_schemas import (
    ReaderAuthorizationRead,
    ReaderAuthorizeIn,
    ReaderConfigRead,
    ReaderExchangeIn,
    ReaderIdentityRead,
)

router = APIRouter(tags=["导航查阅认证"])


@router.get("/navigation/auth-config", response_model=ResponseModel[ReaderConfigRead])
async def reader_config(request: Request) -> ResponseModel[ReaderConfigRead]:
    return success_response(
        data=ReaderConfigRead(
            callback_urls=[origin + "/navigation/callback" for origin in get_request_settings(request).web_origins]
        ),
        request_id=current_request_id(),
    )


@router.post(
    "/admin/nav-reader/authorize",
    response_model=ResponseModel[ReaderAuthorizationRead],
    dependencies=[Depends(require_admin_csrf), Depends(require_permission(PermissionCode.NAVIGATION_CREDENTIALS_READ))],
)
async def authorize_reader(
    payload: ReaderAuthorizeIn,
    service: ReaderServiceDependency,
    response: Response,
    current: Annotated[CurrentAdmin, Depends(get_current_admin)],
) -> ResponseModel[ReaderAuthorizationRead]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(
        data=ReaderAuthorizationRead(code=await service.authorize(current.admin, payload)),
        request_id=current_request_id(),
    )


@router.post(
    "/nav-reader/exchange", response_model=ResponseModel[ReaderIdentityRead], dependencies=[Depends(require_web_origin)]
)
async def exchange_reader(
    payload: ReaderExchangeIn, service: ReaderServiceDependency, request: Request, response: Response
) -> ResponseModel[ReaderIdentityRead]:
    token, csrf, identity = await service.exchange(payload)
    settings = get_request_settings(request)
    for name, value, http_only in [(READER_COOKIE, token, True), (READER_CSRF_COOKIE, csrf, False)]:
        response.set_cookie(
            name,
            value,
            max_age=settings.nav_reader_ttl_seconds,
            path="/",
            httponly=http_only,
            secure=settings.auth_cookie_secure,
            samesite="lax",
        )
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=identity, request_id=current_request_id())


@router.get("/nav-reader/me", response_model=ResponseModel[ReaderIdentityRead])
async def reader_me(current: CurrentReaderDependency, response: Response) -> ResponseModel[ReaderIdentityRead]:
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=current, request_id=current_request_id())


@router.post("/nav-reader/logout", response_model=ResponseModel[None], dependencies=[Depends(require_web_origin)])
async def logout_reader(service: ReaderServiceDependency, request: Request, response: Response) -> ResponseModel[None]:
    await service.logout(request.cookies.get(READER_COOKIE), request.headers.get("x-csrf-token"))
    for name in [READER_COOKIE, READER_CSRF_COOKIE]:
        response.delete_cookie(
            name,
            path="/",
            httponly=name == READER_COOKIE,
            secure=get_request_settings(request).auth_cookie_secure,
            samesite="lax",
        )
    response.headers["Cache-Control"] = "no-store"
    return success_response(data=None, request_id=current_request_id())
