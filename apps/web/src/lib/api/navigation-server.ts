import type { NavTaxonomyRead, PageResultPublicNavSiteRead } from "@pinjie/api-client";

async function get<T>(path: string): Promise<T> {
  if (!process.env.BACKEND_INTERNAL_URL) throw new Error("导航服务尚未配置");
  const response = await fetch(new URL(`/api/v1/navigation/${path}`, process.env.BACKEND_INTERNAL_URL), { cache: "no-store", signal: globalThis.AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("导航服务暂不可用");
  return ((await response.json()) as { data: T }).data;
}

export async function fetchNavigation() {
  const [sites, categories, tags] = await Promise.all([
    get<PageResultPublicNavSiteRead>("sites?page=1&page_size=24"),
    get<NavTaxonomyRead[]>("taxonomy/categories"),
    get<NavTaxonomyRead[]>("taxonomy/tags"),
  ]);
  return { sites, categories, tags };
}
