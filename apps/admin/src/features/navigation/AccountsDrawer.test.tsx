import type { AdminRead, NavAccountRead, NavSiteRead } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AdminContext } from "@/features/auth";
import { server } from "@/test/setup";
import { AccountsDrawer } from "./AccountsDrawer";

const now = "2026-09-09T00:00:00Z";
const admin: AdminRead = { id: "01900000-0000-7000-8000-000000000001", username: "admin", display_name: "管理员", is_active: true, is_superuser: true, roles: [], permissions: [], created_at: now, updated_at: now };
const site: NavSiteRead = { id: "01900000-0000-7000-8000-000000000002", name: "示例站点", url: "https://example.com", category_id: "01900000-0000-7000-8000-000000000003", category: { id: "01900000-0000-7000-8000-000000000003", name: "工具", requires_login: false }, tags: [], icon_url: null, deleted_at: null, updated_at: now };
const account: NavAccountRead = { id: "01900000-0000-7000-8000-000000000004", site_id: site.id, label: "主帐号", username: "sample", password: "sample-only-password", notes: "示例备注", is_active: true, sort_order: 7, updated_at: now };
const root = `http://localhost:3000/api/v1/admin/navigation/sites/${site.id}/accounts`;
const ok = (data: unknown) => HttpResponse.json({ code: "OK", message: "操作成功", data, request_id: "test" });

function mount(principal = admin, currentSite = site) {
  server.use(http.get(root, () => ok([account])));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<ConfigProvider locale={zhCN}><QueryClientProvider client={client}><AdminContext.Provider value={principal}><AccountsDrawer site={currentSite} onClose={() => undefined} /></AdminContext.Provider></QueryClientProvider></ConfigProvider>);
}

describe("account status switch", () => {
  it("keeps the original status after failure and toggles both ways without sending credentials", async () => {
    const user = userEvent.setup();
    let current = { ...account };
    let fail = true;
    mount();
    server.use(
      http.get(root, () => ok([current])),
      http.post(`${root}/bulk`, async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({ ids: [account.id], action: current.is_active ? "disable" : "enable" });
        if (fail) return HttpResponse.json({ code: "CONFLICT", message: "状态保存失败" }, { status: 409 });
        current = { ...current, is_active: !current.is_active };
        return ok({ completed_count: 1 });
      }),
    );
    const toggle = await screen.findByRole("switch", { name: "主帐号状态" });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await screen.findByText("状态保存失败");
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toBeChecked();
    fail = false;
    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(screen.getByText("示例备注")).toBeVisible();
    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
  });

  it.each(["readonly", "recycled"])("shows read-only status for %s accounts", async (mode) => {
    mount(mode === "readonly" ? { ...admin, is_superuser: false, permissions: ["navigation:credentials:read"] } : admin,
      mode === "recycled" ? { ...site, deleted_at: now } : site);
    await screen.findByText("主帐号");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("启用")).toBeVisible();
    expect(screen.queryByRole("button", { name: "edit" })).not.toBeInTheDocument();
  });
});
