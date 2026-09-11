import { afterEach, describe, expect, it, vi } from "vitest";
import { navigationApi } from "./navigation";

describe("navigation API request shapes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("covers metadata, reader, taxonomy, site and account requests", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), method: String(init?.method ?? "GET"), body: typeof init?.body === "string" ? init.body : undefined });
      return new Response(JSON.stringify({ code: "OK", message: "操作成功", data: { id: "x", items: [], completed_count: 1, code: "auth" }, request_id: "test" }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    await navigationApi.metadata("https://example.com");
    await navigationApi.readerConfig();
    await navigationApi.authorize({ state: "s", challenge: "c", redirect_uri: "https://reader.example.com/callback" });
    await navigationApi.taxonomy("categories");
    await navigationApi.saveTaxonomy("categories", { name: "工具", description: "", sort_order: 0, is_active: true, requires_login: false, icon_key: null });
    await navigationApi.bulkTaxonomy("tags", { ids: ["x"], action: "enable" });
    await navigationApi.sites(2, "工具", true, "cat", "tag");
    await navigationApi.saveSite({ name: "站点", url: "https://example.com", description: "", category_id: "cat", tag_ids: [], is_pinned: false, is_published: true, sort_order: 0 });
    await navigationApi.bulkSites({ ids: ["x"], action: "delete" });
    await navigationApi.purgeSites({ ids: ["x"] });
    await navigationApi.accounts("site");
    await navigationApi.saveAccount("site", { label: "主帐号", username: "u", password: "p", notes: "", sort_order: 0, is_active: true });
    await navigationApi.bulkAccounts("site", { ids: ["x"], action: "disable" });

    expect(calls).toHaveLength(13);
    expect(calls[0]).toMatchObject({ method: "POST", body: JSON.stringify({ url: "https://example.com" }) });
    const siteCall = calls[6];
    const accountCall = calls[10];
    if (!siteCall || !accountCall) throw new Error("导航 API 请求未完整记录");
    expect(siteCall.url).toContain("page=2");
    expect(siteCall.url).toContain("category_id=cat");
    expect(siteCall.url).toContain("tag_id=tag");
    expect(accountCall.url).toContain("/sites/site/accounts");
  });
});
