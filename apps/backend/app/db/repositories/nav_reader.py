from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.nav_reader import NavAuthorizationCode, NavReaderSession


class NavReaderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def code(self, digest: str) -> NavAuthorizationCode | None:
        return (
            await self.session.scalars(
                select(NavAuthorizationCode).where(NavAuthorizationCode.code_digest == digest).with_for_update()
            )
        ).one_or_none()

    async def reader(self, digest: str, *, lock: bool = False) -> NavReaderSession | None:
        query = select(NavReaderSession).where(NavReaderSession.token_digest == digest)
        return (await self.session.scalars(query.with_for_update() if lock else query)).one_or_none()

    async def add(self, value: NavAuthorizationCode | NavReaderSession) -> None:
        self.session.add(value)
        await self.session.flush()
