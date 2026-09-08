import type { NavAccountIn, NavAccountRead, NavBulkIn, NavBulkRead, NavCategoryIn, NavCategoryRead, NavMetadataRead, NavSiteIn, NavSitePurgeIn, NavSiteRead, NavTaxonomyIn, NavTaxonomyRead, PageResultNavSiteRead, ReaderAuthorizationRead, ReaderAuthorizeIn } from "@pinjie/api-client";
import { apiRequest, jsonBody } from "./http";
import type { ReaderConfigRead } from "@pinjie/api-client";

export type TaxonomyKind = "categories" | "tags";
const root = "/api/v1/admin/navigation";
export const navigationApi = {
  metadata: (url: string, signal?: globalThis.AbortSignal) => apiRequest<NavMetadataRead>(`${root}/metadata`, { method: "POST", body: jsonBody({ url }), signal, cache: "no-store" }),
  readerConfig: () => apiRequest<ReaderConfigRead>("/api/v1/navigation/auth-config"),
  authorize: (input: ReaderAuthorizeIn) => apiRequest<ReaderAuthorizationRead>("/api/v1/admin/nav-reader/authorize", { method: "POST", body: jsonBody(input), cache: "no-store" }),
  taxonomy: (kind: TaxonomyKind) => apiRequest<(NavCategoryRead | NavTaxonomyRead)[]>(`${root}/taxonomy/${kind}`),
  saveTaxonomy: (kind: TaxonomyKind, input: NavCategoryIn | NavTaxonomyIn, id?: string) => apiRequest<NavCategoryRead | NavTaxonomyRead>(`${root}/taxonomy/${kind}${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: jsonBody(input) }),
  bulkTaxonomy: (kind: TaxonomyKind, input: NavBulkIn) => apiRequest<NavBulkRead>(`${root}/taxonomy/${kind}/bulk`, { method: "POST", body: jsonBody(input) }),
  sites: (page: number, search: string, deleted: boolean) => apiRequest<PageResultNavSiteRead>(`${root}/sites?${new URLSearchParams({ page: String(page), page_size: "20", search, deleted: String(deleted) })}`),
  saveSite: (input: NavSiteIn, id?: string) => apiRequest<NavSiteRead>(`${root}/sites${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: jsonBody(input) }),
  bulkSites: (input: NavBulkIn) => apiRequest<NavBulkRead>(`${root}/sites/bulk`, { method: "POST", body: jsonBody(input) }),
  purgeSites: (input: NavSitePurgeIn) => apiRequest<NavBulkRead>(`${root}/sites/purge`, { method: "POST", body: jsonBody(input) }),
  accounts: (site: string, signal?: globalThis.AbortSignal) => apiRequest<NavAccountRead[]>(`${root}/sites/${site}/accounts`, { cache: "no-store", signal }),
  saveAccount: (site: string, input: NavAccountIn, id?: string) => apiRequest<NavAccountRead>(`${root}/sites/${site}/accounts${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: jsonBody(input), cache: "no-store" }),
  bulkAccounts: (site: string, input: NavBulkIn) => apiRequest<NavBulkRead>(`${root}/sites/${site}/accounts/bulk`, { method: "POST", body: jsonBody(input) }),
};
