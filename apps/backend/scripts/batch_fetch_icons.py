"""
批量抓取导航站点 LOGO、名称、描述并写回数据库。

- 只处理：已发布 (is_published=TRUE)、未删除 (deleted_at IS NULL)、尚无图标 (icon_asset_id IS NULL) 的站点。
- 图标以 PNG 格式保存到 uploads/navigation_icon/{日期}/{hash}_{uuid}.png。
- Asset 记录写入 assets 表，site 记录更新 icon_asset_id。
- 若站点名称或描述为空，同步更新。
- 并发数限制为 3，每批次间隔 1 s，单站抓取超时 25 s，失败跳过。

运行方式（在 apps/backend 目录下）：
    uv run --no-sync python scripts/batch_fetch_icons.py
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import struct
import uuid
from datetime import UTC, datetime
from email.message import Message
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin

import asyncpg
import httpx
from PIL import Image, UnidentifiedImageError

# ─── 配置（与后端 .env 保持一致）───────────────────────────────────────────────
DB_URL = "postgresql://pinjie_nav:VKzm28bBDfvqlRyoDaurMkBciIlQSGWA6@localhost:5432/pinjie_nav_dev"
# 脚本在 scripts/ 下，uploads 在 scripts/../uploads 即 apps/backend/uploads
UPLOAD_LOCAL_ROOT = Path(__file__).parent.parent / "uploads"
UPLOAD_BASE_URL = "/static/uploads"
SCENE = "navigation_icon"
STORAGE_DRIVER = "local"

# 抓取策略
CONCURRENCY = 3  # 并发请求数
BATCH_DELAY = 1.0  # 批次间隔（秒）
FETCH_TIMEOUT = 25.0  # 单站超时（秒）
MAX_HTML_BYTES = 1024 * 1024  # 1 MB HTML
MAX_ICON_BYTES = 2 * 1024 * 1024  # 2 MB 图标


# ─── 图标处理 ─────────────────────────────────────────────────────────────────


def _validate_ico_frames(body: bytes) -> None:
    """校验 ICO 文件帧偏移，防止 Pillow 解析越界分配。"""
    if not body.startswith(b"\x00\x00\x01\x00"):
        return
    try:
        count = struct.unpack_from("<H", body, 4)[0]
        if not 1 <= count <= 64 or len(body) < 6 + count * 16:
            raise ValueError("ico frame count invalid")
        for i in range(count):
            _, _, _, _, _, _, length, offset = struct.unpack_from("<BBBBHHII", body, 6 + i * 16)
            if offset < 6 + count * 16 or offset + length > len(body):
                raise ValueError("ico frame offset out of range")
    except struct.error as exc:
        raise ValueError("ico parse error") from exc


def normalize_icon(raw: bytes) -> bytes:
    """将任意格式图标转换为 PNG（最大 256×256），返回 PNG 字节串。"""
    _validate_ico_frames(raw)
    with Image.open(BytesIO(raw)) as img:
        if img.format not in {"PNG", "JPEG", "WEBP", "GIF", "ICO"}:
            raise ValueError(f"unsupported format: {img.format}")
        if img.width * img.height > 4_000_000:
            raise ValueError("image resolution too large")
        img.seek(0)
        img.thumbnail((256, 256))
        buf = BytesIO()
        img.convert("RGBA").save(buf, format="PNG")
        return buf.getvalue()


# ─── 简单 HTML 解析器 ─────────────────────────────────────────────────────────


class _SimpleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title_parts: list[str] = []
        self.in_title = False
        self.icons: list[str] = []
        self.base: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            content = values.get("content")
            if (
                key in {"og:title", "og:site_name", "description", "og:description"}
                and content
                and not self.meta.get(key)
            ):
                self.meta[key] = content
        elif tag == "base" and self.base is None:
            self.base = values.get("href")
        elif tag == "link":
            rels = set((values.get("rel") or "").lower().split())
            if rels & {"icon", "apple-touch-icon"}:
                href = values.get("href")
                if href and href not in self.icons and len(self.icons) < 12:
                    self.icons.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def extracted_name(self) -> str | None:
        raw = self.meta.get("og:site_name") or self.meta.get("og:title") or "".join(self.title_parts)
        result = " ".join(raw.split())[:100]
        return result or None

    @property
    def extracted_description(self) -> str | None:
        raw = self.meta.get("description") or self.meta.get("og:description") or ""
        result = " ".join(raw.split())[:2000]
        return result or None


def _parse_html(body: bytes, content_type: str) -> _SimpleParser:
    header = Message()
    header["content-type"] = content_type
    preview = _SimpleParser()
    preview.feed(body[:8192].decode("ascii", errors="ignore"))
    encoding = header.get_content_charset() or "utf-8"
    parser = _SimpleParser()
    parser.feed(body.decode(encoding, errors="replace"))
    parser.close()
    return parser


def _icon_candidates(page_url: str, parser: _SimpleParser) -> tuple[list[str], list[bytes]]:
    """
    返回 (http_urls, inline_data_list)。
    http_urls 是需要 HTTP 请求的图标候选地址。
    inline_data_list 是已经解码好的内联图标字节数据。
    """
    http_urls: list[str] = []
    inline_data: list[bytes] = []

    for href in parser.icons[:4]:
        if not href:
            continue
        if href.startswith("data:"):
            # 处理内联 data URI：data:image/png;base64,XXXX 或 data:image/x-icon;base64,...
            try:
                header, _, b64 = href.partition(",")
                if "base64" not in header:
                    continue
                raw = base64.b64decode(b64.strip())
                if raw:
                    inline_data.append(raw)
            except Exception:
                continue
        else:
            try:
                base = urljoin(page_url, parser.base) if parser.base else page_url
                full_url = urljoin(base, href)
                if full_url.startswith("http") and full_url not in http_urls:
                    http_urls.append(full_url)
            except ValueError:
                continue

    # 追加默认 favicon.ico 作为最后候选
    try:
        favicon = urljoin(page_url, "/favicon.ico")
        if favicon not in http_urls:
            http_urls.append(favicon)
    except ValueError:
        pass

    return http_urls, inline_data


# ─── 资产存储 ─────────────────────────────────────────────────────────────────


def _save_icon(png_bytes: bytes, asset_id: uuid.UUID) -> tuple[str, str]:
    """保存 PNG 文件，返回 (file_key, public_url)。"""
    date_bucket = datetime.now(UTC).strftime("%Y%m%d")
    file_hash = hashlib.sha256(png_bytes).hexdigest()
    file_key = f"{SCENE}/{date_bucket}/{file_hash[:16]}_{asset_id.hex[:12]}.png"
    dest = UPLOAD_LOCAL_ROOT / file_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(png_bytes)
    url = f"{UPLOAD_BASE_URL}/{file_key}"
    return file_key, url


# ─── 抓取单个站点 ──────────────────────────────────────────────────────────────


class _FetchResult:
    __slots__ = ("site_id", "name", "description", "png_bytes", "error")

    def __init__(self, site_id: uuid.UUID) -> None:
        self.site_id = site_id
        self.name: str | None = None
        self.description: str | None = None
        self.png_bytes: bytes | None = None
        self.error: str | None = None


async def _fetch_site(client: httpx.AsyncClient, site_id: uuid.UUID, url: str) -> _FetchResult:
    result = _FetchResult(site_id)
    try:
        async with asyncio.timeout(FETCH_TIMEOUT):
            # 1. 抓 HTML 页面
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            ct = resp.headers.get("content-type", "")
            if not any(t in ct for t in ("text/html", "xhtml")):
                result.error = f"非 HTML 类型: {ct[:60]}"
                return result
            body = resp.content[:MAX_HTML_BYTES]
            final_url = str(resp.url)
            parser = _parse_html(body, ct)
            result.name = parser.extracted_name
            result.description = parser.extracted_description

            # 2. 先尝试内联 data URI 图标，再尝试 HTTP 候选地址
            http_urls, inline_data = _icon_candidates(final_url, parser)

            for raw in inline_data:
                try:
                    result.png_bytes = await asyncio.to_thread(normalize_icon, raw[:MAX_ICON_BYTES])
                    break
                except (UnidentifiedImageError, ValueError, OSError):  # fmt: skip
                    continue

            if not result.png_bytes:
                for icon_url in http_urls:
                    try:
                        async with asyncio.timeout(5.0):
                            icon_resp = await client.get(icon_url, follow_redirects=True)
                            if icon_resp.status_code != 200:
                                continue
                            raw = icon_resp.content[:MAX_ICON_BYTES]
                            try:
                                result.png_bytes = await asyncio.to_thread(normalize_icon, raw)
                            except (UnidentifiedImageError, ValueError, OSError):  # fmt: skip
                                continue
                            break
                    except (httpx.HTTPError, asyncio.TimeoutError, OSError):  # fmt: skip
                        continue
    except asyncio.TimeoutError:
        result.error = "请求超时"
    except httpx.HTTPStatusError as exc:
        result.error = f"HTTP {exc.response.status_code}"
    except (httpx.RequestError, OSError) as exc:
        result.error = f"请求失败: {type(exc).__name__}"
    return result


# ─── 写入数据库 ────────────────────────────────────────────────────────────────


async def _write_result(
    conn: asyncpg.Connection,
    result: _FetchResult,
    orig_name: str,
    orig_desc: str,
) -> str:
    parts: list[str] = []
    now = datetime.now(UTC)

    async with conn.transaction():
        if result.png_bytes:
            file_hash = hashlib.sha256(result.png_bytes).hexdigest()
            # 重复文件去重：同 scene + hash 的资产已存在则复用
            existing = await conn.fetchrow(
                "SELECT id, url FROM assets WHERE file_hash = $1 AND scene = $2 LIMIT 1",
                file_hash,
                SCENE,
            )
            if existing:
                asset_id: uuid.UUID = existing["id"]
            else:
                asset_id = uuid.uuid4()
                file_key, icon_url = _save_icon(result.png_bytes, asset_id)
                await conn.execute(  # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
                    """
                    INSERT INTO assets
                        (id, uploader_type, uploader_id, storage_driver, file_key,
                         original_name, mime_type, file_size, file_hash, url, scene, created_at, updated_at)
                    VALUES ($1, 'admin', $1, $2, $3, $4, 'image/png', $5, $6, $7, $8, $9, $9)
                    ON CONFLICT DO NOTHING
                    """,
                    asset_id,
                    STORAGE_DRIVER,
                    file_key,
                    f"icon_{asset_id.hex[:8]}.png",
                    len(result.png_bytes),
                    file_hash,
                    icon_url,
                    SCENE,
                    now,
                )

            await conn.execute(
                "UPDATE nav_sites SET icon_asset_id = $1, updated_at = $2 WHERE id = $3",
                asset_id,
                now,
                result.site_id,
            )
            parts.append("图标已保存")

        # 仅在原值为空时回填名称
        if result.name and not orig_name:
            await conn.execute(
                "UPDATE nav_sites SET name = $1, updated_at = $2 WHERE id = $3",
                result.name[:100],
                now,
                result.site_id,
            )
            parts.append(f"名称={result.name[:20]}")

        # 仅在原值为空时回填描述
        if result.description and not orig_desc:
            await conn.execute(
                "UPDATE nav_sites SET description = $1, updated_at = $2 WHERE id = $3",
                result.description[:2000],
                now,
                result.site_id,
            )
            parts.append("描述已更新")

    return "、".join(parts) if parts else "无可更新内容"


# ─── 主流程 ───────────────────────────────────────────────────────────────────


async def main() -> None:
    print("=" * 60)
    print("  批量抓取导航站点图标")
    print("=" * 60)

    conn = await asyncpg.connect(DB_URL)

    sites = await conn.fetch(
        """
        SELECT id, name, url, description
        FROM nav_sites
        WHERE deleted_at IS NULL
          AND is_published = TRUE
          AND icon_asset_id IS NULL
        ORDER BY sort_order, id
        """
    )
    total = len(sites)
    print(f"\n无图标已发布站点共 {total} 个\n")
    if total == 0:
        print("所有站点已有图标，无需处理。")
        await conn.close()
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    success = skip = fail = 0

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(FETCH_TIMEOUT, connect=10.0),
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        max_redirects=5,
        trust_env=False,
    ) as client:
        for idx, row in enumerate(sites, 1):
            site_id = uuid.UUID(str(row["id"]))
            orig_name = row["name"] or ""
            orig_desc = row["description"] or ""
            site_url = row["url"]

            label = f"[{idx:3d}/{total}] {orig_name or '(无名)':<28}"
            print(f"{label} {site_url[:50]}")

            async with semaphore:
                result = await _fetch_site(client, site_id, site_url)

            if result.error:
                print(f"{'':38}[FAIL] {result.error}")
                fail += 1
            else:
                summary = await _write_result(conn, result, orig_name, orig_desc)
                has_icon = result.png_bytes is not None
                icon_mark = "[OK]  " if has_icon else "[SKIP]"
                print(f"{'':38}{icon_mark} {summary}")
                if has_icon:
                    success += 1
                else:
                    skip += 1

            # 每 CONCURRENCY 个站点后暂停一下，避免集中打流量
            if idx % CONCURRENCY == 0 and idx < total:
                await asyncio.sleep(BATCH_DELAY)

    await conn.close()

    print(f"\n{'=' * 60}")
    print(f"  完成！图标成功: {success}  无图标跳过: {skip}  网络失败: {fail}")
    print(f"  图标存储路径: {UPLOAD_LOCAL_ROOT / SCENE}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
