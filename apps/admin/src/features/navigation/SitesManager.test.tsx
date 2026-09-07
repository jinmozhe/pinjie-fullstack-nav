import type { AdminRead, NavSiteRead } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AdminContext } from "@/features/auth";
import { server } from "@/test/setup";
import { SitesManager } from "./SitesManager";

const now = "2026-09-07T00:00:00Z";
const admin: AdminRead = { id: "01900000-0000-7000-8000-000000000001", username: "admin", display_name: "管理员", is_active: true, is_superuser: true, roles: [], permissions: [], created_at: now, updated_at: now };
const site: NavSiteRead = {
  id: "01900000-0000-7000-8000-000000000002",
  name: "示例站点",
  url: "https://example.com",
  category_id: "01900000-0000-7000-8000-000000000003",
  category: { id: "01900000-0000-7000-8000-000000000003", name: "工具", requires_login: false },
  tags: [], icon_url: null, deleted_at: null, updated_at: now,
};
const root = "http://localhost:3000/api/v1/admin/navigation";
const ok = (data: unknown) => HttpResponse.json({ code: "OK", message: "操作成功", data, request_id: "test-request" });

function renderSites(principal = admin, deleted = false, rows: NavSiteRead[] = [site]) {
  server.use(
    http.get(`${root}/sites`, ({ request }) => {
      const page = Number(new globalThis.URL(request.url).searchParams.get("page") ?? 1);
      return ok({ items: rows.slice((page - 1) * 20, page * 20).map((row) => ({ ...row, deleted_at: deleted ? now : null })), page, page_size: 20, total: rows.length, total_pages: Math.ceil(rows.length / 20) });
    }),
    http.get(`${root}/taxonomy/categories`, () => ok([site.category])),
    http.get(`${root}/taxonomy/tags`, () => ok([])),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { ...render(<ConfigProvider locale={zhCN}><QueryClientProvider client={client}><AdminContext.Provider value={principal}><SitesManager deleted={deleted} /></AdminContext.Provider></QueryClientProvider></ConfigProvider>), client };
}

describe("SitesManager deletion confirmation", () => {
  it.each([false, true])("confirms a single atomic request for bulk=%s and keeps targets after failure", async (bulk) => {
    const user = userEvent.setup();
    const payloads: unknown[] = [];
    server.use(http.post(`${root}/sites/bulk`, async ({ request }) => {
      payloads.push(await request.json());
      if (payloads.length === 1) return HttpResponse.json({ code: "CONFLICT", message: "站点状态已变化", request_id: "test-request" }, { status: 409 });
      return ok({ completed_count: 1 });
    }));
    renderSites();
    const link = await screen.findByRole("link", { name: site.name });
    const row = link.closest("tr");
    if (!row) throw new Error("站点行不存在");
    if (bulk) await user.click(within(row).getByRole("checkbox"));
    const openDelete = async () => {
      if (bulk) await user.click(screen.getByRole("button", { name: /移入回收站/ }));
      else await user.click(within(row).getByRole("button", { name: "delete" }));
    };
    await openDelete();
    const dialog = await screen.findByRole("dialog", { name: "确认移入回收站" });
    expect(payloads).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: /取\s*消/ }));
    expect(payloads).toHaveLength(0);
    await openDelete();
    const reopened = await screen.findByRole("dialog", { name: "确认移入回收站" });
    await user.click(within(reopened).getByRole("button", { name: /确\s*定/ }));
    expect(await within(reopened).findByText("站点状态已变化")).toBeInTheDocument();
    expect(payloads).toEqual([{ ids: [site.id], action: "delete" }]);
    if (bulk) expect(within(row).getByRole("checkbox")).toBeChecked();
    await user.click(within(reopened).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[1]).toEqual(payloads[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    if (bulk) expect(within(row).getByRole("checkbox")).not.toBeChecked();
  }, 60_000);

  it("does not expose delete or selection controls without write permission", async () => {
    renderSites({ ...admin, is_superuser: false, permissions: ["navigation:read"] });
    await screen.findByRole("link", { name: site.name });
    expect(screen.queryByRole("button", { name: "delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("SitesManager permanent deletion", () => {
  it.each([false, true])("confirms permanent deletion and retains targets after failure for bulk=%s", async (bulk) => {
    const user = userEvent.setup();
    const rows = [site, { ...site, id: "01900000-0000-7000-8000-000000000004", name: "第二个站点" }];
    const payloads: unknown[] = [];
    server.use(http.post(`${root}/sites/purge`, async ({ request }) => {
      const body = await request.json();
      payloads.push(body);
      if (payloads.length === 1) return HttpResponse.json({ code: "STATE_CONFLICT", message: "目标状态已变化" }, { status: 409 });
      rows.splice(0, bulk ? 2 : 1);
      return ok({ completed_count: bulk ? 2 : 1 });
    }));
    const { client } = renderSites(admin, true, rows);
    client.setQueryData(["navigation-accounts", site.id], [{ password: "test-only-account-data" }]);
    const link = await screen.findByRole("link", { name: site.name });
    const row = link.closest("tr");
    if (!row) throw new Error("站点行不存在");
    if (bulk) {
      await user.click(within(row).getByRole("checkbox"));
      const second = screen.getByRole("link", { name: "第二个站点" }).closest("tr");
      if (!second) throw new Error("第二个站点行不存在");
      await user.click(within(second).getByRole("checkbox"));
    }
    const openDelete = async () => {
      if (bulk) {
        const buttons = screen.getAllByRole("button", { name: /永久删除/ });
        const button = buttons.find((item) => !item.closest("tr"));
        if (!button) throw new Error("批量永久删除按钮不存在");
        await user.click(button);
      } else await user.click(within(row).getByRole("button", { name: "永久删除" }));
    };
    await openDelete();
    const dialog = await screen.findByRole("dialog", { name: "确认永久删除" });
    expect(dialog).toHaveTextContent("全部帐号资料和标签关联");
    expect(payloads).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: /取\s*消/ }));
    expect(payloads).toEqual([]);
    await openDelete();
    const reopened = await screen.findByRole("dialog", { name: "确认永久删除" });
    await user.click(within(reopened).getByRole("button", { name: /确\s*定/ }));
    expect(await within(reopened).findByText("目标状态已变化")).toBeVisible();
    const expected = { ids: bulk ? rows.map((item) => item.id) : [site.id] };
    expect(payloads).toEqual([expected]);
    if (bulk) expect(within(row).getByRole("checkbox")).toBeChecked();
    await user.click(within(reopened).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(payloads).toEqual([expected, expected]));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("link", { name: site.name })).not.toBeInTheDocument());
    expect(client.getQueryData(["navigation-accounts", site.id])).toBeUndefined();
  }, 60_000);

  it("keeps permanent deletion permission separate from restore permission", async () => {
    const view = renderSites({ ...admin, is_superuser: false, permissions: ["navigation:read", "navigation:write"] }, true);
    await screen.findByRole("link", { name: site.name });
    expect(screen.queryByRole("button", { name: "永久删除" })).not.toBeInTheDocument();
    view.unmount();
    renderSites({ ...admin, is_superuser: false, permissions: ["navigation:read", "navigation:purge"] }, true);
    const row = (await screen.findByRole("link", { name: site.name })).closest("tr");
    if (!row) throw new Error("站点行不存在");
    expect(within(row).getByRole("button", { name: "永久删除" })).toBeVisible();
    expect(within(row).getByRole("checkbox")).toBeEnabled();
    expect(within(row).queryByRole("button", { name: "undo" })).not.toBeInTheDocument();
  });

  it("does not offer permanent deletion in the normal site list", async () => {
    renderSites();
    await screen.findByRole("link", { name: site.name });
    expect(screen.queryByRole("button", { name: "永久删除" })).not.toBeInTheDocument();
  });

  it("returns to a valid page after deleting the last site on page two", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 21 }, (_, index) => ({ ...site, id: `01900000-0000-7000-8000-${String(index + 10).padStart(12, "0")}`, name: `站点 ${index + 1}` }));
    server.use(http.post(`${root}/sites/purge`, () => { rows.pop(); return ok({ completed_count: 1 }); }));
    renderSites(admin, true, rows);
    await screen.findByRole("link", { name: "站点 1" });
    await user.click(screen.getByTitle("2"));
    const row = (await screen.findByRole("link", { name: "站点 21" })).closest("tr");
    if (!row) throw new Error("站点行不存在");
    await user.click(within(row).getByRole("button", { name: "永久删除" }));
    const dialog = await screen.findByRole("dialog", { name: "确认永久删除" });
    await user.click(within(dialog).getByRole("button", { name: /确\s*定/ }));
    expect(await screen.findByRole("link", { name: "站点 1" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "站点 21" })).not.toBeInTheDocument();
  }, 60_000);
});
