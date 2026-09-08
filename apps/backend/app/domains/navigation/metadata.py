import asyncio
import base64
import struct
from email.message import Message
from html.parser import HTMLParser
from io import BytesIO
from typing import Protocol
from urllib.parse import urljoin

from PIL import Image, UnidentifiedImageError

from app.core.public_http import PublicFetchError, PublicHttpClient

from .schemas import NavMetadataRead

HTML_TYPES = frozenset({"text/html", "application/xhtml+xml"})
ICON_TYPES = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/x-icon",
        "image/vnd.microsoft.icon",
        "application/octet-stream",
    }
)


class MetadataSource(Protocol):
    async def read(self, url: str) -> NavMetadataRead: ...


class MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title: list[str] = []
        self.in_title = False
        self.icons: list[str] = []
        self.base: str | None = None
        self.charset: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            content = values.get("content")
            if (
                key in {"og:title", "og:site_name", "description", "og:description"}
                and content
                and not self.meta.get(key)
            ):
                self.meta[key] = content
            if values.get("charset"):
                self.charset = values["charset"]
            elif (values.get("http-equiv") or "").lower() == "content-type" and content:
                header = Message()
                header["content-type"] = content
                self.charset = header.get_content_charset()
        if tag == "base" and self.base is None:
            self.base = values.get("href")
        if tag == "link" and set((values.get("rel") or "").lower().split()) & {"icon", "apple-touch-icon"}:
            href = values.get("href")
            if href and href not in self.icons and len(self.icons) < 12:
                self.icons.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title.append(data)


def parse_metadata(body: bytes, content_type: str) -> MetadataParser:
    header = Message()
    header["content-type"] = content_type
    preview = MetadataParser()
    parser = MetadataParser()
    try:
        preview.feed(body[:8192].decode("ascii", errors="ignore"))
        encoding = header.get_content_charset() or preview.charset or "utf-8"
        parser.feed(body.decode(encoding, errors="replace"))
        parser.close()
    except (LookupError, ValueError, AssertionError) as exc:
        raise PublicFetchError("html_encoding") from exc
    return parser


def validate_ico_frames(body: bytes) -> None:
    if not body.startswith(b"\x00\x00\x01\x00"):
        return
    try:
        count = struct.unpack_from("<H", body, 4)[0]
        if not 1 <= count <= 64 or len(body) < 6 + count * 16:
            raise PublicFetchError("icon_format")
        for index in range(count):
            width, height, _, _, _, _, length, offset = struct.unpack_from("<BBBBHHII", body, 6 + index * 16)
            if offset < 6 + count * 16 or offset + length > len(body):
                raise PublicFetchError("icon_format")
            frame = body[offset : offset + length]
            expected = (width or 256, height or 256)
            if frame.startswith(b"\x89PNG\r\n\x1a\n"):
                with Image.open(BytesIO(frame), formats=["PNG"]) as image:
                    dimensions = image.size
            else:
                header_size, dib_width, dib_height = struct.unpack_from("<Iii", frame)
                if header_size not in {40, 108, 124} or dib_height <= 0 or dib_height % 2:
                    raise PublicFetchError("icon_format")
                dimensions = (dib_width, dib_height // 2)
            if dimensions != expected:
                raise PublicFetchError("icon_format")
    except struct.error as exc:
        raise PublicFetchError("icon_format") from exc


def normalize_icon(body: bytes) -> str:
    try:
        # Pillow loads ICO frames during open; validate embedded dimensions before allowing that allocation.
        validate_ico_frames(body)
        with Image.open(BytesIO(body)) as image:
            if image.format not in {"PNG", "JPEG", "WEBP", "GIF", "ICO"} or image.width * image.height > 4_000_000:
                raise PublicFetchError("icon_format")
            image.seek(0)
            image.thumbnail((256, 256))
            output = BytesIO()
            image.convert("RGBA").save(output, format="PNG")
            encoded = base64.b64encode(output.getvalue()).decode("ascii")
            if len(encoded) > 400000:
                raise PublicFetchError("too_large")
            return encoded
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise PublicFetchError("icon_format") from exc


def clean_text(value: str, maximum: int) -> str | None:
    result = " ".join(value.split())[:maximum]
    return result or None


def icon_candidates(page_url: str, parser: MetadataParser) -> list[str]:
    candidates: list[str] = []
    for href in parser.icons[:2]:
        try:
            base = urljoin(page_url, parser.base) if parser.base else page_url
            candidates.append(urljoin(base, href))
        except ValueError:
            continue
    return list(dict.fromkeys([*candidates, urljoin(page_url, "/favicon.ico")]))


class HtmlMetadataSource:
    def __init__(self, http: PublicHttpClient) -> None:
        self.http = http

    async def read(self, url: str) -> NavMetadataRead:
        if self.http.active >= 4:
            raise PublicFetchError("busy")
        self.http.active += 1
        try:
            async with asyncio.timeout(20):
                page = await self.http.fetch(url, max_bytes=1024 * 1024, mime_types=HTML_TYPES)
                parser = parse_metadata(page.body, page.content_type)
                result = NavMetadataRead(
                    name=clean_text(
                        parser.meta.get("og:site_name") or parser.meta.get("og:title") or "".join(parser.title), 100
                    ),
                    description=clean_text(
                        parser.meta.get("description") or parser.meta.get("og:description") or "", 2000
                    ),
                )
                if not result.name:
                    result.warnings.append("未找到站点名称，已保留原值")
                if not result.description:
                    result.warnings.append("未找到站点描述，已保留原值")
                for candidate in icon_candidates(page.url, parser):
                    try:
                        async with asyncio.timeout(3):
                            icon = await self.http.fetch(candidate, max_bytes=2 * 1024 * 1024, mime_types=ICON_TYPES)
                        # Retain the concurrency slot until the bounded image worker finishes, even on cancellation.
                        worker = asyncio.create_task(asyncio.to_thread(normalize_icon, icon.body))
                        try:
                            result.icon_base64 = await asyncio.shield(worker)
                        except asyncio.CancelledError:
                            await asyncio.gather(worker, return_exceptions=True)
                            raise
                        break
                    except PublicFetchError, TimeoutError:
                        continue
                if not result.icon_base64:
                    result.warnings.append("图标未获取成功或格式不支持，已保留原图标，可手动上传 PNG、JPG 或 WebP")
                return result
        except TimeoutError as exc:
            raise PublicFetchError("timeout") from exc
        finally:
            self.http.active -= 1
