import type { NavAccountRead, NavCategoryRead, PageResultNavSiteGroupRead, PageResultPublicNavSiteRead, ReaderIdentityRead } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_PROFILE } from "@/features/site";
import { server } from "@/test/setup";
import { Navigation } from "./Navigation";

const category: NavCategoryRead = { id: "01900000-0000-7000-8000-000000000001", name: "Private category", description: "", sort_order: 0, is_active: true, requires_login: true, icon_key: "tool" };
const reader: ReaderIdentityRead = { admin_id: "01900000-0000-7000-8000-000000000002", display_name: "Reader", expires_at: "2099-01-01T00:00:00Z" };
const empty: PageResultPublicNavSiteRead = { items: [], total: 0, total_pages: 0, page: 1, page_size: 24 };
const privateSites: PageResultPublicNavSiteRead = { ...empty, total: 1, total_pages: 1, items: [{ id: "01900000-0000-7000-8000-000000000003", name: "Private site", url: "https://example.com/private", description: "", category, tags: [], icon_url: null }] };
const groups: PageResultNavSiteGroupRead = { page: 1, page_size: 6, total: 1, total_pages: 1, items: [{ category, total: 1, items: privateSites.items }] };
const emptyGroups: PageResultNavSiteGroupRead = { page: 1, page_size: 6, total: 0, total_pages: 0, items: [] };
const response = <T,>(data: T) => HttpResponse.json({ code: "OK", message: "成功", data, request_id: "test" });

class TestChannel {
  static channels: TestChannel[] = [];
  onmessage: (() => void) | null = null;
  constructor() { TestChannel.channels.push(this); }
  postMessage() { for (const channel of TestChannel.channels) if (channel !== this) channel.onmessage?.(); }
  close() { TestChannel.channels = TestChannel.channels.filter((channel) => channel !== this); }
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Navigation profile={DEFAULT_SITE_PROFILE} autoLogin={false} initial={{ reader, groups, categories: [category], tags: [] }} /></QueryClientProvider>);
  return client;
}

describe("navigation category access", () => {
  it("reports a failed private category tag request and retries through the reader endpoint", async () => {
    let requests = 0;
    server.use(http.get("http://localhost:3000/api/v1/nav-reader/taxonomy/tags", ({ request }) => {
      expect(new URL(request.url).searchParams.get("category_id")).toBe(category.id);
      requests += 1;
      return requests === 1
        ? HttpResponse.json({ code: "REQUEST_FAILED", message: "标签加载失败" }, { status: 503 })
        : response([{ id: "01900000-0000-7000-8000-000000000009", name: "Private tag", description: "", sort_order: 0, is_active: true }]);
    }));
    mount();
    await userEvent.click(await screen.findByRole("link", { name: category.name }));
    expect(await screen.findByRole("alert")).toHaveTextContent("标签加载失败");
    expect(screen.getByRole("combobox", { name: "按标签筛选" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByRole("option", { name: "Private tag" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "按标签筛选" })).toBeEnabled();
    act(() => { new TestChannel().postMessage(); });
    await waitFor(() => expect(screen.queryByRole("option", { name: "Private tag" })).not.toBeInTheDocument());
  });

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    vi.spyOn(globalThis.HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: globalThis.HTMLDialogElement) { this.setAttribute("open", ""); });
    vi.spyOn(globalThis.HTMLDialogElement.prototype, "close").mockImplementation(function (this: globalThis.HTMLDialogElement) { this.removeAttribute("open"); });
    vi.stubGlobal("BroadcastChannel", TestChannel);
    server.use(
      http.get("http://localhost:3000/api/v1/nav-reader/me", () => response(reader)),
      http.get("http://localhost:3000/api/v1/nav-reader/sites", () => response(privateSites)),
      http.get("http://localhost:3000/api/v1/nav-reader/groups", () => response(groups)),
      http.get("http://localhost:3000/api/v1/navigation/groups", () => response(emptyGroups)),
      http.get("http://localhost:3000/api/v1/nav-reader/sites/:id", () => response(privateSites.items[0])),
      http.get("http://localhost:3000/api/v1/navigation/sites/:id/accounts", () => response([])),
      http.get("http://localhost:3000/api/v1/nav-reader/taxonomy/categories", () => response([category])),
      http.get("http://localhost:3000/api/v1/nav-reader/taxonomy/tags", () => response([])),
      http.get("http://localhost:3000/api/v1/navigation/sites", () => response(empty)),
      http.get("http://localhost:3000/api/v1/navigation/taxonomy/categories", () => response([])),
      http.get("http://localhost:3000/api/v1/navigation/taxonomy/tags", () => response([])),
      http.post("http://localhost:3000/api/navigation/logout", () => response(null)),
    );
  });
  afterEach(() => { TestChannel.channels = []; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("clears restricted categories and sites after logout", async () => {
    const client = mount();
    expect(await screen.findByRole("heading", { name: "Private site" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));
    await screen.findByRole("link", { name: "管理员登录" });
    expect(screen.queryByRole("link", { name: "Private category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Private site" })).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ["reader-navigation"] })).toEqual([]);
  });

  it("keeps category icons decorative and preserves category filtering", async () => {
    let selected: string | null = null;
    server.use(http.get("http://localhost:3000/api/v1/nav-reader/sites", ({ request }) => {
      selected = new URL(request.url).searchParams.get("category_id");
      return response(privateSites);
    }));
    mount();
    const button = await screen.findByRole("link", { name: category.name });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(button);
    await waitFor(() => expect(selected).toBe(category.id));
  });

  it("discards a late authorized response after another tab logs out", async () => {
    const client = mount();
    await screen.findByRole("heading", { name: "Private site" });
    let release: () => void = () => {};
    let started: () => void = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const requested = new Promise<void>((resolve) => { started = resolve; });
    server.use(http.get("http://localhost:3000/api/v1/nav-reader/groups", async () => { started(); await pending; return response(groups); }));
    let refreshing: Promise<void>;
    act(() => { refreshing = client.invalidateQueries({ queryKey: ["reader-navigation"] }); });
    await requested;
    act(() => { new TestChannel().postMessage(); });
    await screen.findByRole("link", { name: "管理员登录" });
    await act(async () => { release(); await refreshing; });
    expect(screen.queryByRole("heading", { name: "Private site" })).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ["reader-navigation"] })).toEqual([]);
  });

  it.each([401, 403, 503])("hides restricted data when identity revalidation returns %s", async (status) => {
    const client = mount();
    await screen.findByRole("heading", { name: "Private site" });
    server.use(http.get("http://localhost:3000/api/v1/nav-reader/me", () => HttpResponse.json({ code: "AUTH_REQUIRED", message: "查阅失败" }, { status })));
    await act(async () => { await client.invalidateQueries({ queryKey: ["reader-identity"] }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Private site" })).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Private category" })).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ["reader-navigation"] })).toEqual([]);
    if (status !== 401) expect(screen.getByRole("alert")).toHaveTextContent("查阅失败");
  });

  it("searches names without carrying the current category and preserves the URL", async () => {
    let requestUrl = "";
    server.use(http.get("http://localhost:3000/api/v1/nav-reader/sites", ({ request }) => { requestUrl = request.url; return response(privateSites); }));
    mount();
    await userEvent.click(await screen.findByRole("link", { name: category.name }));
    await waitFor(() => expect(requestUrl).toContain("category_id="));
    await userEvent.type(screen.getByRole("searchbox", { name: "搜索站点名称" }), "git{Enter}");
    await waitFor(() => expect(requestUrl).toContain("search=git"));
    expect(requestUrl).not.toContain("category_id");
    expect(requestUrl).not.toContain("tag_id");
    expect(window.location.search).toBe("?search=git");
    expect(screen.queryByRole("combobox", { name: "筛选标签" })).not.toBeInTheDocument();
  });

  it("opens public details without rendering or requesting accounts for a guest", async () => {
    const site = { ...privateSites.items[0]!, category: { ...category, requires_login: false } };
    let accountsRequested = false;
    server.use(
      http.get("http://localhost:3000/api/v1/nav-reader/me", () => HttpResponse.json({ code: "AUTH_REQUIRED", message: "未登录" }, { status: 401 })),
      http.get("http://localhost:3000/api/v1/navigation/groups", () => response({ ...groups, items: [{ category: site.category, total: 1, items: [site] }] })),
      http.get("http://localhost:3000/api/v1/navigation/taxonomy/categories", () => response([site.category])),
      http.get("http://localhost:3000/api/v1/navigation/sites/:id", () => response(site)),
      http.get("http://localhost:3000/api/v1/navigation/sites/:id/accounts", () => { accountsRequested = true; return response([]); }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Navigation profile={DEFAULT_SITE_PROFILE} autoLogin={false} /></QueryClientProvider>);
    await userEvent.click(await screen.findByRole("button", { name: "查看 Private site 详情" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("heading", { name: site.name });
    expect(within(dialog).queryByText("帐号资料")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("管理员登录")).not.toBeInTheDocument();
    expect(accountsRequested).toBe(false);
    await userEvent.click(within(dialog).getByRole("link", { name: category.name }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.search).toBe(`?category=${category.id}`);
  });

  it("keeps the external link separate and clears plaintext accounts on close", async () => {
    const account: NavAccountRead = { id: "01900000-0000-7000-8000-000000000004", site_id: privateSites.items[0]!.id, label: "示例帐号", username: "demo@example.com", password: "  sample-only\nvalue  ", notes: "", sort_order: 0, is_active: true, updated_at: "2026-09-07T00:00:00Z" };
    server.use(http.get("http://localhost:3000/api/v1/navigation/sites/:id/accounts", () => response([account])));
    const client = mount();
    const external = await screen.findByRole("link", { name: "访问 Private site（新窗口）" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "查看 Private site 详情" }));
    await screen.findByRole("heading", { name: "示例帐号" });
    expect(screen.getByText("sample-only value").textContent).toBe(account.password);
    expect(screen.queryByRole("button", { name: "复制备注" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ["reader-accounts"] })).toEqual([]);
  });
});
