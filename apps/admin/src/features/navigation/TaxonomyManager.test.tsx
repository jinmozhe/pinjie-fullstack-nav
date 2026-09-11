import type { AdminRead, NavCategoryRead } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AdminContext } from "@/features/auth";
import { server } from "@/test/setup";
import { TaxonomyManager } from "./TaxonomyManager";

const root = "http://localhost:3000/api/v1/admin/navigation/taxonomy";
const now = "2026-09-07T00:00:00Z";
const admin: AdminRead = { id: "01900000-0000-7000-8000-000000000001", username: "admin", display_name: "管理员", is_active: true, is_superuser: true, roles: [], permissions: [], created_at: now, updated_at: now };
const category: NavCategoryRead = { id: "01900000-0000-7000-8000-000000000002", name: "常用工具", requires_login: false, icon_key: "tool", is_active: true };
const ok = (data: unknown) => HttpResponse.json({ code: "OK", message: "操作成功", data, request_id: "test" });

function mount(kind: "categories" | "tags" = "categories", principal = admin) {
  server.use(http.get(`${root}/${kind}`, () => ok(kind === "categories" ? [category] : [{ id: category.id, name: "推荐" }])));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<ConfigProvider locale={zhCN}><QueryClientProvider client={client}><AdminContext.Provider value={principal}><TaxonomyManager kind={kind} /></AdminContext.Provider></QueryClientProvider></ConfigProvider>);
}

describe("category icon configuration", () => {
  it("searches icons and retains the selection after a failed save", async () => {
    const user = userEvent.setup();
    const payloads: unknown[] = [];
    server.use(http.put(`${root}/categories/${category.id}`, async ({ request }) => {
      payloads.push(await request.json());
      if (payloads.length === 1) return HttpResponse.json({ code: "CONFLICT", message: "保存失败" }, { status: 409 });
      return ok({ ...category, icon_key: "code" });
    }));
    mount();
    const name = await screen.findByText(category.name);
    const row = name.closest("tr");
    if (!row) throw new Error("分类行不存在");
    expect(within(row).getByLabelText("工具图标")).toBeVisible();
    await user.click(within(row).getByRole("button", { name: "edit" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑" });
    await user.type(within(dialog).getByRole("combobox", { name: "图标" }), "code");
    await user.click(await screen.findByText("开发"));
    expect(payloads).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: /确\s*定/ }));
    await screen.findByText("保存失败");
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("开发")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(payloads).toHaveLength(2));
    expect(payloads[0]).toMatchObject({ name: category.name, icon_key: "code" });
    expect(payloads[1]).toEqual(payloads[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("only persists clearing the icon when the form is saved", async () => {
    const user = userEvent.setup();
    const payloads: unknown[] = [];
    server.use(http.put(`${root}/categories/${category.id}`, async ({ request }) => {
      payloads.push(await request.json());
      return ok({ ...category, icon_key: null });
    }));
    mount();
    const row = (await screen.findByText(category.name)).closest("tr");
    if (!row) throw new Error("分类行不存在");
    await user.click(within(row).getByRole("button", { name: "edit" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑" });
    await user.click(within(dialog).getByLabelText("清除图标"));
    expect(payloads).toEqual([]);
    expect(within(dialog).getByText("默认分类")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0]).toMatchObject({ icon_key: null });
  });

  it("does not show an icon field for tags", async () => {
    const user = userEvent.setup();
    mount("tags");
    await screen.findByText("推荐");
    await user.click(screen.getByRole("button", { name: /新增标签/ }));
    const dialog = await screen.findByRole("dialog", { name: "新增" });
    expect(within(dialog).queryByRole("combobox", { name: "图标" })).not.toBeInTheDocument();
  });

  it("shows the icon without write controls for read-only administrators", async () => {
    mount("categories", { ...admin, is_superuser: false, permissions: ["navigation:read"] });
    await screen.findByText(category.name);
    expect(screen.getByLabelText("工具图标")).toBeVisible();
    expect(screen.queryByRole("button", { name: "edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增分类/ })).not.toBeInTheDocument();
  });

  it("updates status through the row switch", async () => {
    const user = userEvent.setup();
    const payloads: unknown[] = [];
    server.use(http.post(`${root}/categories/bulk`, async ({ request }) => { payloads.push(await request.json()); return ok({ completed_count: 1 }); }));
    mount();
    const toggle = await screen.findByRole("switch", { name: `${category.name}状态` });
    await user.click(toggle);
    await waitFor(() => expect(payloads).toEqual([{ ids: [category.id], action: "disable" }]));
  });
});
