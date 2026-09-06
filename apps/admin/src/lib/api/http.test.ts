import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/setup";

import { ApiError, apiRequest, errorMessage, jsonBody } from "./http";

const ok = <T>(data: T) => HttpResponse.json({ code: "OK", message: "操作成功", data, request_id: "request" });

describe("admin HTTP authentication boundary", () => {
  it("refreshes once after a protected request returns 401 and replays it once", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    document.cookie = "pinjie_admin_csrf=csrf-value";
    server.use(
      http.get("http://localhost:3000/api/v1/admin/auth/me", () => {
        protectedCalls += 1;
        return protectedCalls === 1 ? HttpResponse.json({ code: "AUTH_REQUIRED", message: "登录已失效" }, { status: 401 }) : ok({ id: "admin" });
      }),
      http.post("http://localhost:3000/api/v1/admin/auth/refresh", ({ request }) => {
        refreshCalls += 1;
        expect(request.headers.get("X-CSRF-Token")).toBe("csrf-value");
        return ok({ session_id: "session" });
      }),
    );

    await expect(apiRequest<{ id: string }>("/api/v1/admin/auth/me")).resolves.toEqual({ id: "admin" });
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it("does not recursively refresh excluded authentication endpoints", async () => {
    let refreshCalls = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/admin/auth/login", () =>
        HttpResponse.json({ code: "AUTH_INVALID", message: "凭据无效" }, { status: 401 }),
      ),
      http.post("http://localhost:3000/api/v1/admin/auth/refresh", () => {
        refreshCalls += 1;
        return ok({ session_id: "session" });
      }),
    );

    await expect(apiRequest("/api/v1/admin/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 401,
      code: "AUTH_INVALID",
    });
    expect(refreshCalls).toBe(0);
  });

  it("surfaces the refresh error when the session cannot be renewed", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/admin/auth/me", () =>
        HttpResponse.json({ code: "AUTH_REQUIRED", message: "需要登录", request_id: "auth-request" }, { status: 401 }),
      ),
      http.post("http://localhost:3000/api/v1/admin/auth/refresh", () =>
        HttpResponse.json({ code: "AUTH_SESSION_REVOKED", message: "会话已撤销", request_id: "refresh-request" }, { status: 401 }),
      ),
    );

    await expect(apiRequest("/api/v1/admin/auth/me")).rejects.toEqual(
      new ApiError(401, "AUTH_SESSION_REVOKED", "会话已撤销", "refresh-request"),
    );
  });

  it.each(["AUTH_INVALID_CREDENTIALS", "UNKNOWN_ERROR"])("does not refresh a business or unknown 401: %s", async (code) => {
    let refreshCalls = 0;
    let passwordCalls = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/admin/auth/password", () => {
        passwordCalls += 1;
        return HttpResponse.json({ code, message: "当前密码错误" }, { status: 401 });
      }),
      http.post("http://localhost:3000/api/v1/admin/auth/refresh", () => {
        refreshCalls += 1;
        return ok({});
      }),
    );
    await expect(apiRequest("/api/v1/admin/auth/password", { method: "POST" })).rejects.toMatchObject({ status: 401, code });
    expect(passwordCalls).toBe(1);
    expect(refreshCalls).toBe(0);
  });

  it.each([[429, "RATE_LIMITED"], [503, "SERVICE_UNAVAILABLE"]] as const)("preserves refresh failure %s and its retry metadata", async (status, code) => {
    let protectedCalls = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/admin/auth/me", () => {
        protectedCalls += 1;
        return HttpResponse.json({ code: "AUTH_REQUIRED" }, { status: 401 });
      }),
      http.post("http://localhost:3000/api/v1/admin/auth/refresh", () =>
        HttpResponse.json({ code, message: "稍后重试", request_id: "refresh-request" }, { status, headers: { "Retry-After": "5" } }),
      ),
    );
    await expect(apiRequest("/api/v1/admin/auth/me")).rejects.toMatchObject({ status, code, requestId: "refresh-request", retryAfter: "5" });
    expect(protectedCalls).toBe(1);
  });

  it("adds JSON and CSRF headers to unsafe requests", async () => {
    document.cookie = "pinjie_admin_csrf=csrf%20token";
    server.use(
      http.patch("http://localhost:3000/api/v1/admin/users/user-id", async ({ request }) => {
        expect(request.headers.get("Accept")).toBe("application/json");
        expect(request.headers.get("Content-Type")).toBe("application/json");
        expect(request.headers.get("X-CSRF-Token")).toBe("csrf token");
        expect(request.headers.has("X-Admin-Confirmation")).toBe(false);
        expect(await request.json()).toEqual({ is_active: false });
        return ok({ is_active: false });
      }),
    );

    await expect(
      apiRequest(
        "/api/v1/admin/users/user-id",
        { method: "PATCH", body: jsonBody({ is_active: false }) },
      ),
    ).resolves.toEqual({ is_active: false });
  });

  it("uses a safe fallback for non-JSON failures and exposes retry metadata", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/admin/permissions", () =>
        new HttpResponse("upstream unavailable", { status: 503, headers: { "Retry-After": "5" } }),
      ),
    );

    await expect(apiRequest("/api/v1/admin/permissions", {}, { retryAuth: false })).rejects.toMatchObject({
      status: 503,
      code: "REQUEST_FAILED",
      message: "请求未完成，请稍后重试",
      retryAfter: "5",
    });
    expect(errorMessage("unknown")).toBe("请求未完成，请稍后重试");
    expect(errorMessage(new Error("明确错误"))).toBe("明确错误");
  });
});
