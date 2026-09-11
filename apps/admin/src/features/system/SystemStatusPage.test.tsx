import type { SystemOverviewRead } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { SystemStatusPage } from "./SystemStatusPage";
import { server } from "../../test/setup";

const mockOverview: SystemOverviewRead = {
  status: "healthy",
  started_at: "2026-08-27T08:00:00Z",
  uptime_seconds: 3600,
  environment: "local",
  release_version: "0.1.0",
  python_version: "3.14.0",
  fastapi_version: "0.116.0",
  timezone: "UTC",
  cors_origin_count: 2,
  infrastructure: {
    database: {
      status: "ok",
      latency_ms: 1.2,
      details: "migration_heads_matched",
    },
    redis: {
      status: "ok",
      latency_ms: 0.8,
      mode: "required",
    },
    storage: {
      driver: "local",
      public_base_url: "/static/uploads",
    },
    security: {
      session_isolation: "separate_cookie_profiles",
      csrf_strategy: "double_submit_hmac",
      refresh_rotation: "single_use_rotation",
    },
  },
  telemetry: {
    status: "ok",
    sampled_at: "2026-08-27T09:00:00Z",
    source: "database",
    user_count: 42,
    admin_count: 3,
    role_count: 2,
    asset_count: 15,
    audit_event_count: 128,
    cached: false,
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SystemStatusPage />
    </QueryClientProvider>,
  );
}

describe("SystemStatusPage", () => {
  it("shows a loading state and then the real backend status overview", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/admin/system/overview", () =>
        HttpResponse.json({ code: "OK", message: "操作成功", data: mockOverview, request_id: "test-req" }),
      ),
    );
    renderPage();
    expect(screen.getByLabelText("正在加载系统状态")).toBeInTheDocument();
    expect(await screen.findByText("所有系统组件运行正常")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL 数据库")).toBeInTheDocument();
    expect(screen.getByText("Redis 缓存中间件")).toBeInTheDocument();
  });

  it("changes the automatic refresh interval", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/admin/system/overview", () =>
        HttpResponse.json({ code: "OK", message: "操作成功", data: mockOverview, request_id: "interval-req" }),
      ),
    );
    renderPage();
    await screen.findByText("所有系统组件运行正常");

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "自动刷新频率" }));
    fireEvent.click(await screen.findByText("每 15 秒"));
  });

  it("shows an error and recovers after retry", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/admin/system/overview", () =>
        HttpResponse.json({ message: "服务不可用" }, { status: 503 }),
      ),
    );
    renderPage();

    expect(await screen.findByText("后端服务不可用")).toBeInTheDocument();
    server.use(
      http.get("http://localhost:3000/api/v1/admin/system/overview", () =>
        HttpResponse.json({ code: "OK", message: "操作成功", data: mockOverview, request_id: "retry-req" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));

    expect(await screen.findByText("所有系统组件运行正常")).toBeInTheDocument();
  });

  it("keeps the last successful overview visible when a background refresh fails", async () => {
    let shouldFail = false;
    server.use(
      http.get("http://localhost:3000/api/v1/admin/system/overview", () => {
        if (shouldFail) return HttpResponse.json({ message: "刷新失败" }, { status: 503 });
        return HttpResponse.json({ code: "OK", message: "操作成功", data: mockOverview, request_id: "initial-req" });
      }),
    );
    renderPage();
    expect(await screen.findByText("所有系统组件运行正常")).toBeInTheDocument();

    shouldFail = true;
    fireEvent.click(screen.getByRole("button", { name: "重新检查状态" }));

    expect(await screen.findByText("刷新失败，当前展示上次成功数据")).toBeInTheDocument();
    expect(screen.getByText("所有系统组件运行正常")).toBeInTheDocument();

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
    await waitFor(() => expect(screen.queryByText("刷新失败，当前展示上次成功数据")).not.toBeInTheDocument());
  });

  it("renders degraded infrastructure and unavailable telemetry", async () => {
    const degradedOverview: SystemOverviewRead = {
      ...mockOverview,
      status: "degraded",
      uptime_seconds: 125,
      infrastructure: {
        ...mockOverview.infrastructure,
        database: { status: "mismatch", latency_ms: 9.5, details: "migration_head_mismatch" },
        redis: { status: "disabled", latency_ms: 0, mode: "disabled" },
      },
      telemetry: {
        status: "unavailable",
        sampled_at: mockOverview.telemetry.sampled_at,
        source: "unavailable",
        user_count: null,
        admin_count: null,
        role_count: null,
        asset_count: null,
        audit_event_count: null,
        cached: true,
      },
    };
    server.use(
      http.get("http://localhost:3000/api/v1/admin/system/overview", () =>
        HttpResponse.json({ code: "OK", message: "操作成功", data: degradedOverview, request_id: "degraded-req" }),
      ),
    );
    renderPage();

    expect(await screen.findByText("部分系统组件处于降级状态")).toBeInTheDocument();
    expect(screen.getByText("2 分钟 5 秒")).toBeInTheDocument();
    expect(screen.getByText("异常")).toBeInTheDocument();
    expect(screen.getByText("未启用")).toBeInTheDocument();
    expect(screen.getByText("暂不可用")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThan(0);
    expect(screen.getByText("C/B Cookie 隔离")).toBeInTheDocument();
  });

  it("renders failed infrastructure, cached telemetry, and multi-day uptime", async () => {
    const failedOverview: SystemOverviewRead = {
      ...mockOverview,
      status: "unavailable",
      uptime_seconds: 90_000,
      infrastructure: {
        ...mockOverview.infrastructure,
        redis: { status: "unavailable", latency_ms: 12, mode: "required" },
      },
      telemetry: {
        ...mockOverview.telemetry,
        source: "redis_cache",
        cached: true,
      },
    };
    server.use(
      http.get("http://localhost:3000/api/v1/admin/system/overview", () =>
        HttpResponse.json({ code: "OK", message: "操作成功", data: failedOverview, request_id: "failed-req" }),
      ),
    );
    renderPage();

    expect(await screen.findByText("核心基础设施不可用")).toBeInTheDocument();
    expect(screen.getByText("1 天 1 小时")).toBeInTheDocument();
    expect(screen.getByText("Redis 缓存")).toBeInTheDocument();
  });
});
