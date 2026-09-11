import type { AdminRead, NavAccountRead, NavSiteRead } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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

function mount(principal = admin, currentSite = site, accountResponse: () => ReturnType<typeof ok> = () => ok([account]), onClose: () => void = () => undefined) {
  server.use(http.get(root, () => accountResponse()));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<ConfigProvider locale={zhCN}><QueryClientProvider client={client}><AdminContext.Provider value={principal}><AccountsDrawer site={currentSite} onClose={onClose} /></AdminContext.Provider></QueryClientProvider></ConfigProvider>);
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

  it("creates, edits and deletes an account through the editor and confirmation", async () => {
    const user = userEvent.setup();
    const requests: unknown[] = [];
    server.use(
      http.post(root, async ({ request }) => { requests.push(await request.json()); return ok(account); }),
      http.put(`${root}/${account.id}`, async ({ request }) => { requests.push(await request.json()); return ok(account); }),
      http.post(`${root}/bulk`, async ({ request }) => { requests.push(await request.json()); return ok({ completed_count: 1 }); }),
    );
    mount();

    await user.click(await screen.findByRole("button", { name: /新增帐号/ }));
    const createTitle = (await screen.findAllByText("新增帐号")).at(-1);
    if (!createTitle) throw new Error("新增帐号标题不存在");
    const createDialog = createTitle.closest('[role="dialog"]');
    if (!(createDialog instanceof globalThis.HTMLElement)) throw new Error("新增帐号弹窗不存在");
    await user.type(within(createDialog).getByRole("textbox", { name: "名称" }), "新帐号");
    await user.type(within(createDialog).getByRole("textbox", { name: "用户名" }), "new-user");
    await user.type(within(createDialog).getByRole("textbox", { name: "密码" }), "new-password");
    await user.click(within(createDialog).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ label: "新帐号", username: "new-user", password: "new-password" });

    const row = (await screen.findByText(account.label ?? "")).closest("tr");
    if (!row) throw new Error("帐号行不存在");
    await user.click(within(row).getByRole("button", { name: "edit" }));
    const editTitle = await screen.findByText("编辑帐号");
    const editDialog = editTitle.closest('[role="dialog"]');
    if (!(editDialog instanceof globalThis.HTMLElement)) throw new Error("编辑帐号弹窗不存在");
    await user.clear(within(editDialog).getByRole("textbox", { name: "用户名" }));
    await user.type(within(editDialog).getByRole("textbox", { name: "用户名" }), "updated-user");
    await user.click(within(editDialog).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toMatchObject({ username: "updated-user" });
    await user.click(within(row).getByRole("button", { name: "delete" }));
    const confirmTitle = await screen.findByText("删除外网帐号");
    const confirm = confirmTitle.closest('[role="dialog"]');
    if (!(confirm instanceof globalThis.HTMLElement)) throw new Error("删除帐号确认框不存在");
    await user.click(within(confirm).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2]).toEqual({ ids: [account.id], action: "delete" });
  });

  it("retries a failed account query, runs bulk status actions and closes the drawer", async () => {
    const user = userEvent.setup();
    let failed = true;
    const requests: unknown[] = [];
    const onClose = () => { requests.push("closed"); };
    server.use(http.post(`${root}/bulk`, async ({ request }) => { requests.push(await request.json()); return ok({ completed_count: 1 }); }));
    mount(admin, site, () => failed ? HttpResponse.json({ code: "SERVICE_UNAVAILABLE", message: "帐号加载失败" }, { status: 503 }) : ok([account]), onClose);
    await screen.findByText("帐号加载失败");
    failed = false;
    await user.click(screen.getByRole("button", { name: /重\s*试/ }));
    const row = (await screen.findByText(account.label ?? "")).closest("tr");
    if (!row) throw new Error("帐号行不存在");
    await user.click(within(row).getByRole("checkbox"));
    const enable = screen.getByRole("img", { name: "check" }).closest("button");
    if (!enable) throw new Error("批量启用按钮不存在");
    await user.click(enable);
    await waitFor(() => expect(requests).toHaveLength(1));
    await user.click(within(row).getByRole("checkbox"));
    const disable = screen.getByRole("img", { name: "stop" }).closest("button");
    if (!disable) throw new Error("批量停用按钮不存在");
    await user.click(disable);
    await waitFor(() => expect(requests).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(requests).toContain("closed");
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
