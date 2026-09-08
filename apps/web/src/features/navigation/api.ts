import type { NavAccountRead, NavCategoryRead, NavTaxonomyRead, PageResultNavSiteGroupRead, PageResultPublicNavSiteRead, PublicNavSiteRead, ReaderIdentityRead } from "@pinjie/api-client";
import { webRequest } from "@/lib/api/http";

export const navigationApi = {
  groups: (page: number, reader: boolean, signal?: globalThis.AbortSignal) => webRequest<PageResultNavSiteGroupRead>(`/api/v1/${reader ? "nav-reader" : "navigation"}/groups?page=${page}&page_size=6`, { cache: "no-store", signal }, false, signal),
  site: (id: string, reader: boolean, signal?: globalThis.AbortSignal) => webRequest<PublicNavSiteRead>(`/api/v1/${reader ? "nav-reader" : "navigation"}/sites/${id}`, { cache: "no-store", signal }, false, signal),
  sites: (page: number, search: string, category: string, tag: string, reader: boolean, signal?: globalThis.AbortSignal) => {
    const params = new globalThis.URLSearchParams({ page: String(page), page_size: "24", search });
    if (!search && category) params.set("category_id", category);
    if (!search && tag) params.set("tag_id", tag);
    return webRequest<PageResultPublicNavSiteRead>(`/api/v1/${reader ? "nav-reader" : "navigation"}/sites?${params}`, { cache: "no-store", signal }, false, signal);
  },
  categories: (reader: boolean, signal?: globalThis.AbortSignal) => webRequest<NavCategoryRead[]>(`/api/v1/${reader ? "nav-reader" : "navigation"}/taxonomy/categories`, { cache: "no-store", signal }, false, signal),
  tags: (signal?: globalThis.AbortSignal) => webRequest<NavTaxonomyRead[]>("/api/v1/navigation/taxonomy/tags", { cache: "no-store", signal }, false, signal),
  me: (signal?: globalThis.AbortSignal) => webRequest<ReaderIdentityRead>("/api/v1/nav-reader/me", { cache: "no-store", signal }, false, signal),
  accounts: (site: string, signal?: globalThis.AbortSignal) => webRequest<NavAccountRead[]>(`/api/v1/navigation/sites/${site}/accounts`, { cache: "no-store", signal }, false, signal),
  logout: () => webRequest<null>("/api/navigation/logout", { method: "POST" }, false),
};
