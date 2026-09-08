import asyncio
import ipaddress
import socket
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from http.cookiejar import CookieJar, DefaultCookiePolicy
from urllib.parse import urljoin, urlsplit

import httpx


class PublicFetchError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class PublicDocument:
    url: str
    content_type: str
    body: bytes


type Resolver = Callable[[str, int], Awaitable[list[str]]]


async def resolve_addresses(host: str, port: int) -> list[str]:
    records = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(str(record[4][0]) for record in records))


def public_address(value: str) -> bool:
    address = ipaddress.ip_address(value)
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped or address.sixtofour or address.teredo or address.is_site_local:
            return False
        # IPv6 translation prefixes can route an apparently global address to a private IPv4 target.
        if address in ipaddress.ip_network("64:ff9b::/96") or address in ipaddress.ip_network("64:ff9b:1::/48"):
            return False
    return address.is_global and not address.is_multicast and not address.is_reserved and not address.is_unspecified


def validate_url(value: str) -> httpx.URL:
    try:
        if (
            not value
            or len(value) > 2000
            or any(ord(char) < 33 for char in value)
            or "\\" in value
            or "%" in urlsplit(value).netloc
        ):
            raise ValueError("invalid URL")
        parsed = urlsplit(value)
        url = httpx.URL(value)
        if (
            parsed.username is not None
            or parsed.password is not None
            or url.scheme not in {"http", "https"}
            or not url.host
        ):
            raise ValueError("invalid origin")
        if url.port not in {None, 80 if url.scheme == "http" else 443}:
            raise ValueError("nonstandard port")
        return url.copy_with(fragment=None)
    except (ValueError, httpx.InvalidURL) as exc:
        raise PublicFetchError("unsafe_url") from exc


class PublicHttpClient:
    def __init__(self, client: httpx.AsyncClient, resolver: Resolver = resolve_addresses) -> None:
        self.client = client
        self.resolver = resolver
        self.active = 0

    async def fetch(self, value: str, *, max_bytes: int, mime_types: frozenset[str]) -> PublicDocument:
        url = validate_url(value)
        try:
            for hop in range(4):
                addresses = await self.resolver(url.host, url.port or (443 if url.scheme == "https" else 80))
                if not addresses or any(not public_address(address) for address in addresses):
                    raise PublicFetchError("unsafe_url")
                # Connect to the validated IP, retaining Host and TLS certificate verification for the original name.
                # Keepalive is disabled on the shared pool to prevent cross-host TLS reuse on a shared IP.
                request = httpx.Request(
                    "GET",
                    url.copy_with(host=addresses[0]),
                    headers={
                        "Host": url.netloc.decode("ascii"),
                        "User-Agent": "PinjieNavMetadata/1.0",
                        "Accept": ", ".join(sorted(mime_types)),
                        "Accept-Encoding": "identity",
                        "Connection": "close",
                    },
                    extensions={
                        "sni_hostname": url.host,
                        "timeout": {"connect": 4.0, "read": 4.0, "write": 4.0, "pool": 1.0},
                    },
                )
                response = await self.client.send(request, stream=True, follow_redirects=False)
                try:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location or hop == 3:
                            raise PublicFetchError("redirect_limit")
                        url = validate_url(urljoin(str(url), location))
                        continue
                    if response.status_code != 200:
                        raise PublicFetchError("upstream_status")
                    content_type = response.headers.get("content-type", "")
                    if content_type.split(";", 1)[0].strip().lower() not in mime_types:
                        raise PublicFetchError("content_type")
                    if response.headers.get("content-encoding", "identity").lower() not in {"", "identity"}:
                        raise PublicFetchError("content_encoding")
                    declared = response.headers.get("content-length")
                    if declared and (not declared.isdecimal() or len(declared) > 10 or int(declared) > max_bytes):
                        raise PublicFetchError("too_large")
                    body = bytearray()
                    async for chunk in response.aiter_raw():
                        if len(body) + len(chunk) > max_bytes:
                            raise PublicFetchError("too_large")
                        body.extend(chunk)
                    return PublicDocument(str(url), content_type, bytes(body))
                finally:
                    await response.aclose()
        except httpx.TimeoutException as exc:
            raise PublicFetchError("timeout") from exc
        except (httpx.HTTPError, OSError, ValueError) as exc:
            raise PublicFetchError("network") from exc
        raise PublicFetchError("redirect_limit")

    async def close(self) -> None:
        await self.client.aclose()


def create_public_http_client() -> PublicHttpClient:
    return PublicHttpClient(
        httpx.AsyncClient(
            trust_env=False,
            follow_redirects=False,
            cookies=CookieJar(policy=DefaultCookiePolicy(allowed_domains=())),
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=0),
            timeout=httpx.Timeout(4.0, pool=1.0),
        )
    )
