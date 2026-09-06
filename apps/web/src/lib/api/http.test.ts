import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@/test/setup";

import { webRequest } from "./http";

const ok = <T>(data: T) => HttpResponse.json({ code: "OK", message: "OK", data, request_id: "request" });

describe("web HTTP authentication boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["/api/v1/nav-reader/sites/site/accounts", "AUTH_SESSION_REVOKED"],
    ["/api/v1/navigation/sites", "AUTH_REQUIRED"],
    ["/api/navigation/logout", "NAV_AUTH_FAILED"],
  ])("keeps reader expiry isolated for %s", async (path, code) => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    let refreshCalls = 0;
    server.use(
      http.get(`http://localhost:3000${path}`, () => HttpResponse.json({ code }, { status: 401 })),
      http.post("http://localhost:3000/api/v1/auth/refresh", () => {
        refreshCalls += 1;
        return ok({});
      }),
    );
    await expect(webRequest(path)).rejects.toMatchObject({ status: 401, code });
    expect(refreshCalls).toBe(0);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "pinjie:reader-expired" }));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "pinjie:session-expired" }));
  });

  it("sends the reader CSRF cookie and preserves temporary reader failures", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    document.cookie = "pinjie_web_csrf=web-csrf";
    document.cookie = "pinjie_reader_csrf=reader-csrf";
    server.use(
      http.post("http://localhost:3000/api/navigation/logout", ({ request }) => {
        expect(request.headers.get("X-CSRF-Token")).toBe("reader-csrf");
        return HttpResponse.json({ code: "SERVICE_UNAVAILABLE" }, { status: 503 });
      }),
    );
    await expect(webRequest("/api/navigation/logout", { method: "POST" })).rejects.toMatchObject({ status: 503 });
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "pinjie:reader-expired" }));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "pinjie:session-expired" }));
  });

  it.each([
    ["POST", "/api/v1/users/me/password", "AUTH_INVALID_CREDENTIALS"],
    ["DELETE", "/api/v1/users/me", "AUTH_INVALID_CREDENTIALS"],
    ["GET", "/api/v1/users/me", "UNKNOWN_ERROR"],
  ])("preserves a business or unknown 401 for %s %s", async (method, path, code) => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    let originalCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.all(`http://localhost:3000${path}`, () => {
        originalCalls += 1;
        return HttpResponse.json({ code, message: "Current password is incorrect" }, { status: 401 });
      }),
      http.post("http://localhost:3000/api/v1/auth/refresh", () => {
        refreshCalls += 1;
        return ok({});
      }),
    );
    await expect(webRequest(path, { method })).rejects.toMatchObject({ status: 401, code });
    expect(originalCalls).toBe(1);
    expect(refreshCalls).toBe(0);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "pinjie:session-expired" }));
  });

  it.each([[429, "RATE_LIMITED"], [503, "SERVICE_UNAVAILABLE"]] as const)("preserves refresh failure %s without expiring the session", async (status, code) => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    let protectedCalls = 0;
    server.use(
      http.get("http://localhost:3000/api/v1/users/me", () => {
        protectedCalls += 1;
        return HttpResponse.json({ code: "AUTH_REQUIRED" }, { status: 401 });
      }),
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({ code, message: "Try again later", request_id: "refresh-request" }, { status, headers: { "Retry-After": "5" } }),
      ),
    );
    await expect(webRequest("/api/v1/users/me")).rejects.toMatchObject({ status, code, requestId: "refresh-request", retryAfter: "5" });
    expect(protectedCalls).toBe(1);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "pinjie:session-expired" }));
  });

  it("replays once with the rotated CSRF cookie", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    document.cookie = "pinjie_web_csrf=old-csrf";
    server.use(
      http.patch("http://localhost:3000/api/v1/users/me", ({ request }) => {
        protectedCalls += 1;
        if (protectedCalls === 1) return HttpResponse.json({ code: "AUTH_REQUIRED" }, { status: 401 });
        expect(request.headers.get("X-CSRF-Token")).toBe("new-csrf");
        return ok({ id: "user" });
      }),
      http.post("http://localhost:3000/api/v1/auth/refresh", () => {
        refreshCalls += 1;
        document.cookie = "pinjie_web_csrf=new-csrf";
        return ok({});
      }),
    );
    await expect(webRequest("/api/v1/users/me", { method: "PATCH" })).resolves.toEqual({ id: "user" });
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it("expires the session after a definitive refresh rejection", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    server.use(
      http.get("http://localhost:3000/api/v1/users/me", () => HttpResponse.json({ code: "AUTH_REQUIRED" }, { status: 401 })),
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({ code: "AUTH_SESSION_REVOKED", request_id: "refresh-request" }, { status: 401 }),
      ),
    );
    await expect(webRequest("/api/v1/users/me")).rejects.toMatchObject({ status: 401, code: "AUTH_SESSION_REVOKED", requestId: "refresh-request" });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "pinjie:session-expired" }));
  });
});
