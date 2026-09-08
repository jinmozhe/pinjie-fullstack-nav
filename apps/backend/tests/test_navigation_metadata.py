import asyncio
import base64
import struct
from io import BytesIO

import httpx
import pytest
from PIL import Image

from app.api.dependencies import CurrentAdmin, get_current_admin
from app.api.navigation_dependencies import get_metadata_service
from app.core.config import Settings
from app.core.exceptions import AppException
from app.core.identifiers import new_uuid7
from app.core.public_http import (
    PublicFetchError,
    PublicHttpClient,
    create_public_http_client,
    public_address,
    validate_url,
)
from app.core.security import token_digest
from app.db.models import Admin, AdminSession
from app.domains.navigation.metadata import HTML_TYPES, HtmlMetadataSource, normalize_icon, parse_metadata
from app.domains.navigation.schemas import NavMetadataRead
from app.main import create_app
from app.services.navigation_metadata import NavigationMetadataService
from tests.conftest import TEST_SECRETS


async def public_dns(host: str, port: int) -> list[str]:
    return ["93.184.216.34"]


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.1",
        "169.254.169.254",
        "100.64.0.1",
        "0.0.0.0",
        "224.0.0.1",
        "::1",
        "fc00::1",
        "fec0::1",
        "fe80::1",
        "::ffff:127.0.0.1",
        "64:ff9b::a00:1",
        "2002:7f00:1::",
    ],
)
def test_private_and_transition_addresses_are_blocked(address: str) -> None:
    assert not public_address(address)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://user:pass@example.com",
        "http://example.com:8000",
        "https://example.com:80",
        "https://exa%6dple.com",
        "https://example.com\\@localhost",
        "https://example.com\n",
    ],
)
def test_unsafe_urls_are_rejected(url: str) -> None:
    with pytest.raises(PublicFetchError):
        validate_url(url)


async def test_fixed_ip_keeps_hostname_verification_and_rechecks_redirect() -> None:
    calls: list[httpx.Request] = []

    async def dns(host: str, port: int) -> list[str]:
        return ["127.0.0.1"] if host == "internal.example" else ["93.184.216.34"]

    def respond(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(
            302, headers={"location": "http://internal.example/private", "set-cookie": "session=test"}
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        fetcher = PublicHttpClient(client, dns)
        with pytest.raises(PublicFetchError, match="unsafe_url"):
            await fetcher.fetch("https://example.com", max_bytes=1024, mime_types=HTML_TYPES)
    assert len(calls) == 1
    assert calls[0].url.host == "93.184.216.34"
    assert calls[0].headers["host"] == "example.com"
    assert calls[0].extensions["sni_hostname"] == "example.com"
    assert "cookie" not in calls[0].headers and "authorization" not in calls[0].headers


async def test_mixed_dns_answer_is_rejected_before_any_connection() -> None:
    async def mixed(host: str, port: int) -> list[str]:
        return ["93.184.216.34", "10.0.0.1"]

    def unexpected(request: httpx.Request) -> httpx.Response:
        pytest.fail("No connection is allowed for mixed DNS answers")

    async with httpx.AsyncClient(transport=httpx.MockTransport(unexpected)) as client:
        with pytest.raises(PublicFetchError, match="unsafe_url"):
            await PublicHttpClient(client, mixed).fetch("https://example.com", max_bytes=100, mime_types=HTML_TYPES)


@pytest.mark.parametrize(
    "headers,body,reason",
    [
        ({"content-type": "text/html", "content-length": "101"}, b"x", "too_large"),
        ({"content-type": "text/html"}, b"x" * 101, "too_large"),
        ({"content-type": "image/svg+xml"}, b"svg", "content_type"),
        ({"content-type": "text/html", "content-encoding": "gzip"}, b"gzip", "content_encoding"),
    ],
)
async def test_response_limits_and_type_checks(headers: dict[str, str], body: bytes, reason: str) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers=headers, stream=httpx.ByteStream(body))

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(PublicFetchError, match=reason):
            await PublicHttpClient(client, public_dns).fetch(
                "https://example.com", max_bytes=100, mime_types=HTML_TYPES
            )


def test_html_entities_charset_and_relative_icons() -> None:
    html = '<meta charset="gbk"><title>示例 &amp; 工具</title><meta name="description" content="中文 简介"><base href="/assets/"><link rel="shortcut icon" href="logo.ico">'
    parsed = parse_metadata(html.encode("gbk"), "text/html")
    assert "".join(parsed.title) == "示例 & 工具"
    assert parsed.meta["description"] == "中文 简介"
    assert parsed.base == "/assets/" and parsed.icons == ["logo.ico"]


def test_image_conversion_rejects_svg_and_bounds_dimensions() -> None:
    image = BytesIO()
    Image.new("RGB", (512, 256), "red").save(image, format="PNG")
    png = base64.b64decode(normalize_icon(image.getvalue()))
    with Image.open(BytesIO(png)) as result:
        assert result.format == "PNG" and result.size == (256, 128)
    with pytest.raises(PublicFetchError, match="icon_format"):
        normalize_icon(b'<svg xmlns="http://www.w3.org/2000/svg"/>')
    # A directory claiming 16x16 must not load a larger embedded PNG before validation.
    frame = image.getvalue()
    ico = struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", 16, 16, 0, 0, 1, 32, len(frame), 22) + frame
    with pytest.raises(PublicFetchError, match="icon_format"):
        normalize_icon(ico)


async def test_missing_icon_returns_text_with_explicit_warning() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/favicon.ico":
            return httpx.Response(404)
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            stream=httpx.ByteStream(b'<title>Example</title><meta name="description" content="Description">'),
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        fetcher = PublicHttpClient(client, public_dns)
        result = await HtmlMetadataSource(fetcher).read("https://example.com")
        assert result.name == "Example" and result.description == "Description"
        assert result.icon_base64 is None and len(result.warnings) == 1
        assert fetcher.active == 0


async def test_concurrency_rejection_and_cancellation_release_capacity() -> None:
    entered = asyncio.Event()

    async def slow(request: httpx.Request) -> httpx.Response:
        entered.set()
        await asyncio.Event().wait()
        raise AssertionError("Cancelled request cannot complete")

    async with httpx.AsyncClient(transport=httpx.MockTransport(slow)) as client:
        fetcher = PublicHttpClient(client, public_dns)
        fetcher.active = 4
        with pytest.raises(PublicFetchError, match="busy"):
            await HtmlMetadataSource(fetcher).read("https://example.com")
        fetcher.active = 0
        task = asyncio.create_task(HtmlMetadataSource(fetcher).read("https://example.com"))
        await entered.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert fetcher.active == 0


@pytest.mark.parametrize("reason,status", [("unsafe_url", 422), ("busy", 429), ("timeout", 504), ("network", 502)])
async def test_service_failure_mapping_is_explicit_and_safe(reason: str, status: int) -> None:
    class FailedSource:
        async def read(self, url: str) -> NavMetadataRead:
            raise PublicFetchError(reason)

    with pytest.raises(AppException) as caught:
        await NavigationMetadataService(FailedSource()).fetch("https://example.com/?secret=sensitive")
    assert caught.value.status_code == status
    assert "sensitive" not in caught.value.message


async def test_lifespan_client_does_not_retain_remote_cookies() -> None:
    fetcher = create_public_http_client()
    response = httpx.Response(
        200, headers={"set-cookie": "session=remote; Path=/"}, request=httpx.Request("GET", "https://example.com")
    )
    fetcher.client.cookies.extract_cookies(response)
    assert not list(fetcher.client.cookies.jar)
    await fetcher.close()
    assert fetcher.client.is_closed


async def test_metadata_success_resolves_icon_against_final_page_and_base() -> None:
    icon = BytesIO()
    Image.new("RGB", (16, 16), "red").save(icon, format="ICO", sizes=[(16, 16)])
    paths: list[str] = []

    def respond(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        if request.url.path == "/":
            return httpx.Response(302, headers={"location": "/docs/page"})
        if request.url.path == "/docs/page":
            return httpx.Response(
                200,
                headers={"content-type": "text/html"},
                stream=httpx.ByteStream(
                    b'<base href="../assets/"><title>Page title</title><meta property="og:site_name" content="Site name"><meta property="og:description" content="Summary"><link rel="icon" href="logo.ico">'
                ),
            )
        return httpx.Response(200, headers={"content-type": "image/x-icon"}, stream=httpx.ByteStream(icon.getvalue()))

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await HtmlMetadataSource(PublicHttpClient(client, public_dns)).read("https://example.com")
    assert paths == ["/", "/docs/page", "/assets/logo.ico"]
    assert result.name == "Site name" and result.description == "Summary"
    assert result.icon_base64 and not result.warnings


async def test_endpoint_requires_identity_permission_and_csrf_before_fetch() -> None:
    settings = Settings(_env_file=None, LOG_FILE_ENABLED=False, **TEST_SECRETS)
    app = create_app(settings)
    principal: CurrentAdmin | None = None
    calls: list[str] = []

    async def current_admin() -> CurrentAdmin:
        if principal is None:
            raise AppException(status_code=401, code="AUTH_REQUIRED", message="需要登录")
        return principal

    class Source:
        async def read(self, url: str) -> NavMetadataRead:
            calls.append(url)
            return NavMetadataRead(name="Example")

    app.dependency_overrides[get_current_admin] = current_admin
    app.dependency_overrides[get_metadata_service] = lambda: NavigationMetadataService(Source())
    endpoint = "/api/v1/admin/navigation/metadata"
    csrf = "test-csrf"
    _, _, _, hmac = settings.authentication_secrets()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
        assert (await client.post(endpoint, json={"url": "https://example.com"})).status_code == 401
        principal = CurrentAdmin(
            Admin(id=new_uuid7(), is_superuser=False), AdminSession(csrf_digest=token_digest(csrf, hmac)), frozenset()
        )
        client.cookies.set("pinjie_admin_csrf", csrf)
        headers = {"Origin": "http://localhost:3001", "X-CSRF-Token": csrf}
        assert (await client.post(endpoint, json={"url": "https://example.com"}, headers=headers)).status_code == 403
        principal = CurrentAdmin(principal.admin, principal.login_session, frozenset({"navigation:write"}))
        assert (await client.post(endpoint, json={"url": "https://example.com"})).status_code == 403
        assert not calls
        result = await client.post(endpoint, json={"url": "https://example.com"}, headers=headers)
        assert result.status_code == 200 and result.json()["data"]["name"] == "Example"
        assert result.headers["cache-control"] == "no-store"
        assert calls == ["https://example.com"]
