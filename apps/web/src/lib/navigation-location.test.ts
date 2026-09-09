import { describe, expect, it } from "vitest";
import { HOME_LOCATION, TOP_LOCATION, isNavigationHome, navigationHref, navigationLocation } from "./navigation-location";

describe("navigation URLs", () => {
  it("keeps pinned pages independent from home and ignores unrelated URL filters", () => {
    const location = navigationLocation(new globalThis.URLSearchParams("page=2&search=git&category=old&tag=old"), "/top");
    expect(location).toEqual({ ...TOP_LOCATION, page: 2 });
    expect(navigationHref(location)).toBe("/top?page=2");
    expect(navigationHref(TOP_LOCATION)).toBe("/top");
    expect(isNavigationHome(location)).toBe(false);
    expect(isNavigationHome(HOME_LOCATION)).toBe(true);
  });
  it("makes name search exclusive while retaining pagination", () => {
    const location = navigationLocation(new globalThis.URLSearchParams("search=%20git%20&category=old&tag=old&page=2"));
    expect(location).toEqual({ search: "git", category: "", tag: "", page: 2 });
    expect(navigationHref(location)).toBe("/?search=git&page=2");
  });
  it("preserves literal search characters and restores taxonomy URLs", () => {
    const location = { ...HOME_LOCATION, search: "C++ & %_" };
    expect(navigationLocation(new globalThis.URLSearchParams(navigationHref(location).slice(2)))).toEqual(location);
    expect(navigationHref({ ...HOME_LOCATION, category: "category-id", tag: "tag-id" })).toBe("/?category=category-id&tag=tag-id");
    expect(isNavigationHome(HOME_LOCATION)).toBe(true);
  });
  it.each(["0", "-1", "1.5", "invalid", "Infinity"])("normalizes invalid page %s", page => {
    expect(navigationLocation(new globalThis.URLSearchParams({ page })).page).toBe(1);
  });
});
