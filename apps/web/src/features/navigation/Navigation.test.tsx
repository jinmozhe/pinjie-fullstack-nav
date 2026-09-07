import type { NavCategoryRead, PageResultPublicNavSiteRead, ReaderIdentityRead } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
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
  render(<QueryClientProvider client={client}><Navigation profile={DEFAULT_SITE_PROFILE} autoLogin={false} initial={{ reader, sites: privateSites, categories: [category], tags: [] }} /></QueryClientProvider>);
  return client;
}

describe("navigation category access", () => {
  beforeEach(() => {
    vi.stubGlobal("BroadcastChannel", TestChannel);
    server.use(
      http.get("http://localhost:3000/api/v1/nav-reader/me", () => response(reader)),
      http.get("http://localhost:3000/api/v1/nav-reader/sites", () => response(privateSites)),
      http.get("http://localhost:3000/api/v1/nav-reader/taxonomy/categories", () => response([category])),
      http.get("http://localhost:3000/api/v1/navigation/sites", () => response(empty)),
      http.get("http://localhost:3000/api/v1/navigation/taxonomy/categories", () => response([])),
      http.get("http://localhost:3000/api/v1/navigation/taxonomy/tags", () => response([])),
      http.post("http://localhost:3000/api/navigation/logout", () => response(null)),
    );
  });
  afterEach(() => { TestChannel.channels = []; vi.unstubAllGlobals(); });

  it("clears restricted categories and sites after logout", async () => {
    const client = mount();
    expect(await screen.findByRole("heading", { name: "Private site" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "退出登录" }));
    await screen.findByRole("link", { name: "管理员登录" });
    expect(screen.queryByRole("button", { name: "Private category" })).not.toBeInTheDocument();
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
    const button = await screen.findByRole("button", { name: category.name });
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
    server.use(http.get("http://localhost:3000/api/v1/nav-reader/sites", async () => { started(); await pending; return response(privateSites); }));
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
    expect(screen.queryByRole("button", { name: "Private category" })).not.toBeInTheDocument();
    expect(client.getQueriesData({ queryKey: ["reader-navigation"] })).toEqual([]);
    if (status !== 401) expect(screen.getByRole("alert")).toHaveTextContent("查阅失败");
  });
});
