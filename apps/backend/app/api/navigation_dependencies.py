from typing import Annotated

from fastapi import Depends, Request

from app.api.dependencies import CurrentAdmin, DatabaseSession, get_current_admin, get_request_settings, get_resources
from app.core.request_metadata import request_metadata
from app.domains.navigation.reader_schemas import ReaderIdentityRead
from app.services.nav_reader import READER_COOKIE, NavReaderService
from app.services.navigation import NavigationService


def get_reader_service(request: Request, session: DatabaseSession) -> NavReaderService:
    return NavReaderService(
        session=session,
        settings=get_request_settings(request),
        session_factory=get_resources(request).session_factory,
        metadata=request_metadata(request),
    )


ReaderServiceDependency = Annotated[NavReaderService, Depends(get_reader_service)]


async def get_current_reader(request: Request, service: ReaderServiceDependency) -> ReaderIdentityRead:
    admin, reader = await service.current(request.cookies.get(READER_COOKIE))
    request.state.current_admin_id = str(admin.id)
    return service.identity(admin, reader)


CurrentReaderDependency = Annotated[ReaderIdentityRead, Depends(get_current_reader)]


def get_navigation_service(request: Request, session: DatabaseSession) -> NavigationService:
    return NavigationService(
        session=session, session_factory=get_resources(request).session_factory, metadata=request_metadata(request)
    )


def get_admin_navigation_service(
    request: Request, session: DatabaseSession, current: Annotated[CurrentAdmin, Depends(get_current_admin)]
) -> NavigationService:
    return NavigationService(
        session=session,
        session_factory=get_resources(request).session_factory,
        metadata=request_metadata(request),
        actor_id=current.admin.id,
    )


NavigationServiceDependency = Annotated[NavigationService, Depends(get_navigation_service)]
AdminNavigationServiceDependency = Annotated[NavigationService, Depends(get_admin_navigation_service)]
