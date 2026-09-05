import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARDED_HEADERS = ["accept", "content-type", "cookie", "origin", "user-agent", "x-csrf-token", "x-request-id"];
const SAFE_METHODS = new Set(["GET", "HEAD"]);
const WEB_COOKIE_NAMES = new Set(["pinjie_web_access", "pinjie_web_refresh", "pinjie_web_csrf"]);
const READER_COOKIE_NAMES = new Set(["pinjie_reader_session", "pinjie_reader_csrf"]);
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedRoute(method: string, path: string[]): boolean {
  const route = path.join("/");
  if (method === "GET" && /^(nav-reader\/me|navigation\/sites|navigation\/taxonomy\/(categories|tags))$/.test(route)) return true;
  if (method === "GET" && path.length === 4 && path[0] === "navigation" && path[1] === "sites" && SESSION_ID.test(path[2] ?? "") && path[3] === "accounts") return true;
  if (method === "GET" && route === "system/site-profile") return true;
  if (method === "POST" && /^(auth\/(register|login|refresh|logout)|users\/me\/(password|sessions\/revoke-others))$/.test(route)) return true;
  if (method === "POST" && route === "assets/upload") return true;
  if (["GET", "PATCH", "DELETE"].includes(method) && route === "users/me") return true;
  if (method === "PUT" && route === "users/me/avatar") return true;
  if (method === "GET" && route === "users/me/sessions") return true;
  return method === "DELETE" && path.length === 4 && path.slice(0, 3).join("/") === "users/me/sessions" && SESSION_ID.test(path[3] ?? "");
}

function webCookies(cookieHeader: string, reader: boolean): string {
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter((item) => (reader ? READER_COOKIE_NAMES : WEB_COOKIE_NAMES).has(item.split("=", 1)[0] ?? ""))
    .join("; ");
}

function configuredWebOrigin(): string | undefined {
  const value = process.env.WEB_PUBLIC_ORIGIN;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const backendURL = process.env.BACKEND_INTERNAL_URL;
  if (!backendURL) return NextResponse.json({ code: "SERVICE_UNAVAILABLE", message: "后端服务尚未配置", request_id: request.headers.get("x-request-id") ?? "" }, { status: 503 });
  const { path } = await context.params;
  const reader = path[0] === "nav-reader" || path[0] === "navigation";
  const source = new URL(request.url);
  if (!isAllowedRoute(request.method, path)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "接口不存在", request_id: request.headers.get("x-request-id") ?? "" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const webOrigin = configuredWebOrigin();
  if (!SAFE_METHODS.has(request.method) && !webOrigin) {
    return NextResponse.json(
      { code: "SERVICE_UNAVAILABLE", message: "Web 公开来源尚未配置", request_id: request.headers.get("x-request-id") ?? "" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!SAFE_METHODS.has(request.method) && request.headers.get("origin") !== webOrigin) {
    return NextResponse.json(
      { code: "CSRF_REJECTED", message: "请求来源不在允许范围内", request_id: request.headers.get("x-request-id") ?? "" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const target = new URL(`/api/v1/${path.join("/")}${source.search}`, backendURL);
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, name === "cookie" ? webCookies(value, reader) : value);
  }
  try {
    const requestInit: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      cache: "no-store",
      redirect: "manual",
    };
    if (requestInit.body) requestInit.duplex = "half";
    const response = await fetch(target, requestInit);
    const outgoing = new Headers();
    if (reader) outgoing.set("Cache-Control", "no-store");
    for (const name of ["cache-control", "content-type", "retry-after", "x-request-id", "x-trace-id"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
    for (const cookie of responseHeaders.getSetCookie?.() ?? []) {
      if (cookie.startsWith("pinjie_web_")) outgoing.append("set-cookie", cookie);
    }
    return new NextResponse(response.body, { status: response.status, headers: outgoing });
  } catch {
    return NextResponse.json({ code: "SERVICE_UNAVAILABLE", message: "后端服务不可用", request_id: request.headers.get("x-request-id") ?? "" }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
