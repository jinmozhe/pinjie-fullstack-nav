export type NavigationLocation = { page: number; search: string; category: string; tag: string };

export const HOME_LOCATION: NavigationLocation = { page: 1, search: "", category: "", tag: "" };

export function navigationLocation(params: globalThis.URLSearchParams): NavigationLocation {
  const search = (params.get("search") ?? "").trim().slice(0, 100);
  const page = Number(params.get("page") ?? 1);
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    search,
    category: search ? "" : params.get("category") ?? "",
    tag: search ? "" : params.get("tag") ?? "",
  };
}

export function navigationHref(location: NavigationLocation): string {
  const params = new globalThis.URLSearchParams();
  if (location.search) params.set("search", location.search);
  else {
    if (location.category) params.set("category", location.category);
    if (location.tag) params.set("tag", location.tag);
  }
  if (location.page > 1) params.set("page", String(location.page));
  return params.size ? `/?${params}` : "/";
}

export function isNavigationHome(location: NavigationLocation): boolean {
  return !location.search && !location.category && !location.tag;
}
