import type { NavCategoryRead, NavTaxonomyRead, PageResultNavSiteGroupRead, PageResultPublicNavSiteRead, ReaderIdentityRead } from "@pinjie/api-client";
import { cookies } from "next/headers";
import { HOME_LOCATION, isNavigationHome, type NavigationLocation } from "@/lib/navigation-location";

class NavigationFetchError extends Error {
  constructor(readonly status: number) { super("导航服务暂不可用"); }
}

async function get<T>(path: string, cookie = ""): Promise<T> {
  if (!process.env.BACKEND_INTERNAL_URL) throw new Error("导航服务尚未配置");
  const response = await fetch(new URL(`/api/v1/${path}`, process.env.BACKEND_INTERNAL_URL), { cache: "no-store", headers: { cookie }, signal: globalThis.AbortSignal.timeout(10000) });
  if (!response.ok) throw new NavigationFetchError(response.status);
  return ((await response.json()) as { data: T }).data;
}

export async function fetchNavigation(location: NavigationLocation = HOME_LOCATION) {
  const session = (await cookies()).get("pinjie_reader_session");
  const cookie = session ? `${session.name}=${session.value}` : "";
  let reader: ReaderIdentityRead | undefined;
  if (cookie) {
    try { reader = await get<ReaderIdentityRead>("nav-reader/me", cookie); }
    catch (error) {
      if (!(error instanceof NavigationFetchError && error.status === 401)) throw error;
    }
  }
  const scope = reader ? "nav-reader" : "navigation";
  const home = isNavigationHome(location);
  const params = new globalThis.URLSearchParams({ page: String(location.page), page_size: "24" });
  if (location.top) params.set("pinned_only", "true");
  if (location.search) params.set("search", location.search);
  else {
    if (location.category) params.set("category_id", location.category);
    if (location.tag) params.set("tag_id", location.tag);
  }
  const [sites, groups, categories, tags] = await Promise.all([
    home ? undefined : get<PageResultPublicNavSiteRead>(`${scope}/sites?${params}`, reader ? cookie : ""),
    home ? get<PageResultNavSiteGroupRead>(`${scope}/groups?page=${location.page}&page_size=6`, reader ? cookie : "") : undefined,
    get<NavCategoryRead[]>(`${scope}/taxonomy/categories`, reader ? cookie : ""),
    get<NavTaxonomyRead[]>("navigation/taxonomy/tags"),
  ]);
  return { sites, groups, categories, tags, reader };
}
