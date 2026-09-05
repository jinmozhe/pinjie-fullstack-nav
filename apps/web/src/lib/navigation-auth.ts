import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const FLOW = "pinjie_reader_flow";
const SUPPRESSED = "pinjie_reader_suppressed";
const ATTEMPTED = "pinjie_reader_attempted";
const READER_COOKIES = new Set(["pinjie_reader_session", "pinjie_reader_csrf"]);

function origin(value: string | undefined): string {
  if (!value) throw new Error("导航登录地址尚未配置");
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("导航登录地址配置无效");
  return parsed.origin;
}

function config() {
  const web = origin(process.env.WEB_PUBLIC_ORIGIN);
  const admin = origin(process.env.ADMIN_PUBLIC_ORIGIN);
  if (web === admin) throw new Error("Web 和 Admin 必须使用不同来源");
  if (!process.env.BACKEND_INTERNAL_URL) throw new Error("后端地址尚未配置");
  return { web, admin, backend: process.env.BACKEND_INTERNAL_URL, secure: web.startsWith("https:") };
}

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function failure(message: string, status = 503) {
  return privateResponse(NextResponse.json({ code: "NAV_AUTH_FAILED", message, request_id: "" }, { status }));
}

export async function startReaderLogin(request: Request) {
  try {
    const cfg = config();
    const jar = await cookies();
    const silent = new URL(request.url).searchParams.get("silent") === "1";
    if (silent && (jar.has(SUPPRESSED) || jar.has(ATTEMPTED))) return privateResponse(NextResponse.redirect(cfg.web));
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const target = new URL("/navigation/authorize", cfg.admin);
    target.searchParams.set("state", state);
    target.searchParams.set("challenge", challenge);
    target.searchParams.set("redirect_uri", `${cfg.web}/navigation/callback`);
    if (silent) target.searchParams.set("silent", "1");
    const response = privateResponse(NextResponse.redirect(target));
    response.cookies.set(FLOW, JSON.stringify({ state, verifier, expires: Date.now() + 300000 }), { path: "/api/navigation", httpOnly: true, secure: cfg.secure, sameSite: "lax", maxAge: 300 });
    response.cookies.set(ATTEMPTED, "1", { path: "/", httpOnly: true, secure: cfg.secure, sameSite: "lax", maxAge: 60 });
    return response;
  } catch {
    return failure("导航登录配置不可用");
  }
}

export async function readerCallback(request: Request) {
  let cfg: ReturnType<typeof config>;
  try { cfg = config(); } catch { return failure("导航登录配置不可用"); }
  if (request.headers.get("origin") !== cfg.web) return failure("请求来源不匹配", 403);
  const jar = await cookies();
  const response = privateResponse(NextResponse.json({ code: "SUCCESS", data: null, message: "登录已完成", request_id: "" }));
  response.cookies.set(FLOW, "", { path: "/api/navigation", httpOnly: true, secure: cfg.secure, sameSite: "lax", maxAge: 0 });
  const invalid = () => { const result = failure("导航登录已失效，请重新登录", 401); result.cookies.set(FLOW, "", { path: "/api/navigation", httpOnly: true, secure: cfg.secure, sameSite: "lax", maxAge: 0 }); return result; };
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || !("state" in payload) || typeof payload.state !== "string") return invalid();
    const flow: unknown = JSON.parse(jar.get(FLOW)?.value ?? "null");
    if (!flow || typeof flow !== "object" || !("state" in flow) || !("verifier" in flow) || !("expires" in flow) || typeof flow.state !== "string" || typeof flow.verifier !== "string" || typeof flow.expires !== "number" || flow.expires <= Date.now()) return invalid();
    const state = payload.state;
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || state.length !== flow.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))) return invalid();
    if ("error" in payload && payload.error === "login_required") return response;
    const code = "code" in payload ? payload.code : null;
    if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(code)) return invalid();
    const upstream = await fetch(new URL("/api/v1/nav-reader/exchange", cfg.backend), {
      method: "POST", headers: { "Content-Type": "application/json", Origin: cfg.web }, cache: "no-store", redirect: "manual", signal: globalThis.AbortSignal.timeout(10000),
      body: JSON.stringify({ code, verifier: flow.verifier, state, redirect_uri: `${cfg.web}/navigation/callback` }),
    });
    if (!upstream.ok) return invalid();
    response.cookies.set(SUPPRESSED, "", { path: "/", httpOnly: true, secure: cfg.secure, sameSite: "lax", maxAge: 0 });
    for (const cookie of upstream.headers.getSetCookie()) {
      if (READER_COOKIES.has(cookie.split("=", 1)[0] ?? "")) response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch {
    return invalid();
  }
}

export async function logoutReader(request: Request) {
  try {
    const cfg = config();
    if (request.headers.get("origin") !== cfg.web) return failure("请求来源不匹配", 403);
    const jar = await cookies();
    const upstream = await fetch(new URL("/api/v1/nav-reader/logout", cfg.backend), {
      method: "POST", headers: { Origin: cfg.web, Cookie: jar.getAll().filter((item) => READER_COOKIES.has(item.name)).map((item) => `${item.name}=${item.value}`).join("; "), "X-CSRF-Token": request.headers.get("x-csrf-token") ?? "" },
      cache: "no-store", redirect: "manual", signal: globalThis.AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return failure("退出未完成，请重试", upstream.status);
    const response = privateResponse(NextResponse.json({ code: "SUCCESS", message: "已退出", data: null, request_id: "" }));
    response.cookies.set(SUPPRESSED, "1", { path: "/", httpOnly: true, secure: cfg.secure, sameSite: "lax", maxAge: 31536000 });
    response.cookies.set(FLOW, "", { path: "/api/navigation", httpOnly: true, secure: cfg.secure, sameSite: "lax", maxAge: 0 });
    for (const cookie of upstream.headers.getSetCookie()) {
      if (READER_COOKIES.has(cookie.split("=", 1)[0] ?? "")) response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch {
    return failure("退出服务不可用，请重试");
  }
}

export async function shouldProbeReader(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(process.env.ADMIN_PUBLIC_ORIGIN && !jar.has(SUPPRESSED) && !jar.has(ATTEMPTED));
}
