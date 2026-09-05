"use client";

type ApiEnvelope<T> = { code: string; message: string; data: T; request_id: string };
type ApiErrorBody = { code?: string; message?: string; request_id?: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly retryAfter?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshPromise: Promise<boolean> | null = null;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function throwIfCancelled(signal?: globalThis.AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new Error("Request cancelled");
}

function readCookie(name: string): string | undefined {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : undefined;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try { body = (await response.json()) as ApiErrorBody; } catch { body = {}; }
  return new ApiError(
    response.status,
    body.code ?? "REQUEST_FAILED",
    body.message ?? "请求未完成，请稍后重试",
    body.request_id,
    response.headers.get("retry-after") ?? undefined,
  );
}

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrf = readCookie("pinjie_web_csrf");
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : undefined,
      });
      return response.ok;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function webRequest<T>(
  path: string,
  init: RequestInit = {},
  retryAuth = true,
  cancellationSignal?: globalThis.AbortSignal,
): Promise<T> {
  throwIfCancelled(cancellationSignal);
  const method = (init.method ?? "GET").toUpperCase();
  const reader = path.startsWith("/api/v1/nav-reader/") || path.startsWith("/api/v1/navigation/") || path.startsWith("/api/navigation/");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(reader ? "pinjie_reader_csrf" : "pinjie_web_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(new URL(path, window.location.origin), { ...init, method, headers, credentials: "include" });
  throwIfCancelled(cancellationSignal);
  if (response.status === 401 && !reader && retryAuth && !path.startsWith("/api/v1/auth/")) {
    const refreshed = await refreshSession();
    throwIfCancelled(cancellationSignal);
    if (refreshed) return webRequest<T>(path, init, false, cancellationSignal);
  }
  if (response.status === 401 && !path.startsWith("/api/v1/auth/")) {
    window.dispatchEvent(new Event(reader ? "pinjie:reader-expired" : "pinjie:session-expired"));
  }
  if (!response.ok) throw await parseError(response);
  return ((await response.json()) as ApiEnvelope<T>).data;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求未完成，请稍后重试";
}
