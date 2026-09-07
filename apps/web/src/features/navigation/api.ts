import type { NavAccountRead, NavCategoryRead, NavTaxonomyRead, PageResultPublicNavSiteRead, ReaderIdentityRead } from "@pinjie/api-client";
import { webRequest } from "@/lib/api/http";

export const navigationApi = {
  sites: (page: number, search: string, category: string, tag: string, reader: boolean, signal?: globalThis.AbortSignal) => {
    const params = new globalThis.URLSearchParams({ page: String(page), page_size: "24", search });
    if (category) params.set("category_id", category);
    if (tag) params.set("tag_id", tag);
    return webRequest<PageResultPublicNavSiteRead>(`/api/v1/${reader ? "nav-reader" : "navigation"}/sites?${params}`, { cache: "no-store", signal }, false, signal);
  },
  categories: (reader: boolean, signal?: globalThis.AbortSignal) => webRequest<NavCategoryRead[]>(`/api/v1/${reader ? "nav-reader" : "navigation"}/taxonomy/categories`, { cache: "no-store", signal }, false, signal),
  tags: (signal?: globalThis.AbortSignal) => webRequest<NavTaxonomyRead[]>("/api/v1/navigation/taxonomy/tags", { cache: "no-store", signal }, false, signal),
  me: (signal?: globalThis.AbortSignal) => webRequest<ReaderIdentityRead>("/api/v1/nav-reader/me", { cache: "no-store", signal }, false, signal),
  accounts: (site: string, signal?: globalThis.AbortSignal) => webRequest<NavAccountRead[]>(`/api/v1/navigation/sites/${site}/accounts`, { cache: "no-store", signal }, false, signal),
  logout: () => webRequest<null>("/api/navigation/logout", { method: "POST" }, false),
};
