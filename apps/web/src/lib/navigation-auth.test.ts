import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logoutReader, readerCallback, startReaderLogin } from "./navigation-auth";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({
  has: (name: string) => jar.has(name),
  get: (name: string) => jar.has(name) ? { name, value: jar.get(name) } : undefined,
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
}) }));

describe("independent reader login", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    jar.clear();
    vi.stubEnv("WEB_PUBLIC_ORIGIN", "http://localhost:3000");
    vi.stubEnv("ADMIN_PUBLIC_ORIGIN", "http://localhost:3001");
    vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend.test");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { fetchMock.mockReset(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("binds authorization to a secret HttpOnly verifier and sends only S256", async () => {
    const response = await startReaderLogin(new Request("http://localhost:3000/api/navigation/start"));
    const target = new URL(response.headers.get("location") ?? "");
    const cookie = response.cookies.get("pinjie_reader_flow");
    const flow = JSON.parse(cookie?.value ?? "{}");
    expect(target.origin).toBe("http://localhost:3001");
    expect(target.searchParams.get("state")).toBe(flow.state);
    expect(target.toString()).not.toContain(flow.verifier);
    expect(target.searchParams.get("challenge")).toHaveLength(43);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("suppresses automatic sign-in after explicit logout", async () => {
    jar.set("pinjie_reader_suppressed", "1");
    const automatic = await startReaderLogin(new Request("http://localhost:3000/api/navigation/start?silent=1"));
    expect(automatic.headers.get("location")).toBe("http://localhost:3000/");
    expect(automatic.cookies.get("pinjie_reader_flow")).toBeUndefined();
    const explicit = await startReaderLogin(new Request("http://localhost:3000/api/navigation/start"));
    expect(explicit.cookies.get("pinjie_reader_flow")).toBeDefined();
  });

  it("rejects a callback with a different browser state without exchange", async () => {
    jar.set("pinjie_reader_flow", JSON.stringify({ state: "a".repeat(43), verifier: "v".repeat(43), returnTo: "/", expires: Date.now() + 60000 }));
    const response = await readerCallback(new Request("http://localhost:3000/api/navigation/callback", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ state: "b".repeat(43), code: "c".repeat(43) }),
    }));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets only reader cookies, excludes session secrets from the callback body", async () => {
    jar.set("pinjie_reader_flow", JSON.stringify({ state: "s".repeat(43), verifier: "v".repeat(43), returnTo: "/top", expires: Date.now() + 60000 }));
    const headers = new Headers();
    headers.append("set-cookie", "pinjie_reader_session=reader-test-value; Path=/; HttpOnly; SameSite=Lax");
    headers.append("set-cookie", "pinjie_admin_access=must-not-forward; Path=/; HttpOnly");
    fetchMock.mockResolvedValue(new Response("{}", { headers }));
    const response = await readerCallback(new Request("http://localhost:3000/api/navigation/callback", {
      method: "POST", headers: { origin: "http://localhost:3000" },
      body: JSON.stringify({ state: "s".repeat(43), code: "c".repeat(43) }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("reader-test-value");
    expect(response.headers.get("set-cookie")).not.toContain("must-not-forward");
    const body = await response.text();
    expect(body).not.toContain("reader-test-value");
    expect(JSON.parse(body).data).toEqual({ return_to: "/top" });
  });

  it("retains top for silent anonymous return and rejects external return targets", async () => {
    const start = await startReaderLogin(new Request("http://localhost:3000/api/navigation/start?return_to=/top"));
    const cookie = start.cookies.get("pinjie_reader_flow");
    const flow = JSON.parse(cookie?.value ?? "{}");
    jar.set("pinjie_reader_flow", cookie?.value ?? "");
    const callback = await readerCallback(new Request("http://localhost:3000/api/navigation/callback", {
      method: "POST", headers: { origin: "http://localhost:3000" },
      body: JSON.stringify({ state: flow.state, error: "login_required" }),
    }));
    expect((await callback.json()).data).toEqual({ return_to: "/top" });
    expect(fetchMock).not.toHaveBeenCalled();
    jar.set("pinjie_reader_suppressed", "1");
    const suppressed = await startReaderLogin(new Request("http://localhost:3000/api/navigation/start?silent=1&return_to=/top"));
    expect(suppressed.headers.get("location")).toBe("http://localhost:3000/top");
    const external = await startReaderLogin(new Request("http://localhost:3000/api/navigation/start?silent=1&return_to=https://evil.example"));
    expect(external.headers.get("location")).toBe("http://localhost:3000/");
    jar.set("pinjie_reader_flow", JSON.stringify({ ...flow, returnTo: "//evil.example" }));
    const invalid = await readerCallback(new Request("http://localhost:3000/api/navigation/callback", {
      method: "POST", headers: { origin: "http://localhost:3000" },
      body: JSON.stringify({ state: flow.state, error: "login_required" }),
    }));
    expect(invalid.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logout revokes only the reader profile and sets the suppression marker", async () => {
    jar.set("pinjie_reader_session", "reader-test-value");
    jar.set("pinjie_reader_csrf", "csrf-test-value");
    jar.set("pinjie_admin_access", "admin-test-value");
    fetchMock.mockResolvedValue(new Response("{}"));
    const response = await logoutReader(new Request("http://localhost:3000/api/navigation/logout", { method: "POST", headers: { origin: "http://localhost:3000", "x-csrf-token": "csrf-test-value" } }));
    expect(response.status).toBe(200);
    expect(response.cookies.get("pinjie_reader_suppressed")?.value).toBe("1");
    const [target, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(target)).toBe("http://backend.test/api/v1/nav-reader/logout");
    expect(new Headers(init?.headers).get("cookie")).not.toContain("admin-test-value");
  });

  it("rejects a cross-origin logout before contacting the backend", async () => {
    const response = await logoutReader(new Request("http://localhost:3000/api/navigation/logout", { method: "POST", headers: { origin: "http://localhost:3001" } }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
