"""
对仍无图标的站点，用 Google Favicon 服务兜底抓取。

只处理：已发布、未删除、icon_asset_id IS NULL 的站点。
Google API: https://www.google.com/s2/favicons?domain=<host>&sz=64

运行方式（在 apps/backend 目录下）：
    uv run --no-sync python scripts/batch_fetch_icons_fallback.py
"""

from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit

import asyncpg
import httpx
from PIL import Image, UnidentifiedImageError

# ─── 配置 ────────────────────────────────────────────────────────────────────
DB_URL = "postgresql://pinjie_nav:VKzm28bBDfvqlRyoDaurMkBciIlQSGWA6@localhost:5432/pinjie_nav_dev"
UPLOAD_LOCAL_ROOT = Path(__file__).parent.parent / "uploads"
UPLOAD_BASE_URL = "/static/uploads"
SCENE = "navigation_icon"
STORAGE_DRIVER = "local"

CONCURRENCY = 5  # 并发数（Google 接口较快）
FETCH_TIMEOUT = 10.0  # 单站超时
MAX_ICON_BYTES = 512 * 1024  # Google 返回的图标一般很小


def _google_favicon_url(site_url: str, size: int = 64) -> str:
    """从站点 URL 提取主机名，构造 Google Favicon API 地址。"""
    try:
        host = urlsplit(site_url).hostname or ""
    except Exception:
        host = ""
    return f"https://www.google.com/s2/favicons?domain={host}&sz={size}"


def _normalize_icon(raw: bytes) -> bytes:
    """将原始字节转为标准 PNG（最大 128×128）。"""
    with Image.open(BytesIO(raw)) as img:
        if img.format not in {"PNG", "JPEG", "WEBP", "GIF", "ICO"}:
            raise ValueError(f"unsupported: {img.format}")
        if img.width * img.height > 4_000_000:
            raise ValueError("too large")
        img.seek(0)
        img.thumbnail((128, 128))
        buf = BytesIO()
        img.convert("RGBA").save(buf, format="PNG")
        return buf.getvalue()


def _save_icon(png_bytes: bytes, asset_id: uuid.UUID) -> tuple[str, str]:
    """保存 PNG 到 uploads 目录，返回 (file_key, url)。"""
    date_bucket = datetime.now(UTC).strftime("%Y%m%d")
    file_hash = hashlib.sha256(png_bytes).hexdigest()
    file_key = f"{SCENE}/{date_bucket}/{file_hash[:16]}_{asset_id.hex[:12]}.png"
    dest = UPLOAD_LOCAL_ROOT / file_key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(png_bytes)
    return file_key, f"{UPLOAD_BASE_URL}/{file_key}"


async def _fetch_and_save(
    conn: asyncpg.Connection,
    client: httpx.AsyncClient,
    site_id: uuid.UUID,
    site_url: str,
) -> str:
    """抓取 Google favicon 并写入数据库，返回结果描述。"""
    google_url = _google_favicon_url(site_url)
    now = datetime.now(UTC)

    try:
        async with asyncio.timeout(FETCH_TIMEOUT):
            resp = await client.get(google_url, follow_redirects=True)
            if resp.status_code != 200:
                return f"HTTP {resp.status_code}"
            raw = resp.content[:MAX_ICON_BYTES]
            # Google 对不存在的域名返回 16x16 灰色默认图标（约 286 字节）
            # 过滤掉这种几乎全灰的占位图
            if len(raw) < 300:
                return "Google 返回默认占位图，跳过"
            try:
                png_bytes = await asyncio.to_thread(_normalize_icon, raw)
            except (UnidentifiedImageError, ValueError, OSError) as exc:
                return f"图标处理失败: {exc}"
    except asyncio.TimeoutError:
        return "超时"
    except httpx.HTTPError as exc:
        return f"请求失败: {type(exc).__name__}"

    file_hash = hashlib.sha256(png_bytes).hexdigest()
    async with conn.transaction():
        # 重复文件去重
        existing = await conn.fetchrow(
            "SELECT id FROM assets WHERE file_hash = $1 AND scene = $2 LIMIT 1",
            file_hash,
            SCENE,
        )
        if existing:
            asset_id: uuid.UUID = existing["id"]
        else:
            asset_id = uuid.uuid4()
            file_key, icon_url = _save_icon(png_bytes, asset_id)
            # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
            await conn.execute(
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
                len(png_bytes),
                file_hash,
                icon_url,
                SCENE,
                now,
            )
        await conn.execute(
            "UPDATE nav_sites SET icon_asset_id = $1, updated_at = $2 WHERE id = $3",
            asset_id,
            now,
            site_id,
        )
    return "图标已保存 (Google 兜底)"


async def main() -> None:
    print("=" * 60)
    print("  Google Favicon 兜底抓取")
    print("=" * 60)

    conn = await asyncpg.connect(DB_URL)
    sites = await conn.fetch(
        """
        SELECT id, name, url
        FROM nav_sites
        WHERE deleted_at IS NULL
          AND is_published = TRUE
          AND icon_asset_id IS NULL
        ORDER BY sort_order, id
        """
    )
    total = len(sites)
    print(f"\n仍无图标站点: {total} 个\n")
    if total == 0:
        print("全部已有图标，无需处理。")
        await conn.close()
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    success = skip = fail = 0

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(FETCH_TIMEOUT, connect=5.0),
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        trust_env=False,
    ) as client:
        for idx, row in enumerate(sites, 1):
            site_id = uuid.UUID(str(row["id"]))
            name = row["name"] or "(无名)"
            site_url = row["url"]
            label = f"[{idx:3d}/{total}] {name:<28}"
            print(f"{label} {site_url[:48]}")

            async with semaphore:
                result = await _fetch_and_save(conn, client, site_id, site_url)

            if "已保存" in result:
                print(f"{'':38}[OK]   {result}")
                success += 1
            elif "跳过" in result or "占位" in result:
                print(f"{'':38}[SKIP] {result}")
                skip += 1
            else:
                print(f"{'':38}[FAIL] {result}")
                fail += 1

            # 小间隔，不对 Google 过于集中打流量
            if idx % 10 == 0 and idx < total:
                await asyncio.sleep(0.5)

    await conn.close()

    print(f"\n{'=' * 60}")
    print(f"  完成！成功: {success}  占位跳过: {skip}  失败: {fail}")
    print(f"  剩余无图标: {skip + fail} 个（站点可能无有效 favicon）")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
