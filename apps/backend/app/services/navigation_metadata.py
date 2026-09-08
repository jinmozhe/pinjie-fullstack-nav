from loguru import logger

from app.core.exceptions import AppException
from app.core.public_http import PublicFetchError
from app.domains.navigation.metadata import MetadataSource
from app.domains.navigation.schemas import NavMetadataRead

_FAILURES = {
    "unsafe_url": (422, "NAV_FETCH_UNSAFE_URL", "仅支持标准 HTTP(S) 端口的公网地址，目标或跳转地址不符合要求"),
    "busy": (429, "NAV_FETCH_BUSY", "抓取任务较多，请稍后重试"),
    "timeout": (504, "NAV_FETCH_TIMEOUT", "目标网站响应超时，请重试或手动填写"),
}


class NavigationMetadataService:
    def __init__(self, source: MetadataSource) -> None:
        self.source = source

    async def fetch(self, url: str) -> NavMetadataRead:
        try:
            result = await self.source.read(url)
        except PublicFetchError as exc:
            status, code, message = _FAILURES.get(
                exc.reason, (502, "NAV_FETCH_FAILED", "无法读取目标网页，请检查网址或手动填写")
            )
            logger.bind(fetch_reason=exc.reason).warning("navigation metadata fetch rejected")
            raise AppException(
                status_code=status, code=code, message=message, headers={"Retry-After": "5"} if status == 429 else None
            ) from exc
        if result.warnings:
            logger.bind(warning_count=len(result.warnings)).info("navigation metadata fetch partially completed")
        return result
