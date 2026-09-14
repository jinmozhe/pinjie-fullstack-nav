// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseXSites, XSitesError } from "./sites";

const site = { name: "示例", url: "https://example.com/", description: "简介" };

describe("parseXSites", () => {
  it("preserves display values and ordering, and accepts an empty list", () => {
    const sites = [site, { name: "第二项", url: "http://second.example/path", description: "" }];
    expect(parseXSites(JSON.stringify(sites))).toEqual(sites);
    expect(parseXSites("[]")).toEqual([]);
  });

  it.each([
    [null, "$"],
    [{ sites: [] }, "$"],
    [[null], "$[0]"],
    [[[]], "$[0]"],
    [[{ ...site, name: "  " }], "$[0].name"],
    [[{ url: site.url, description: "" }], "$[0].name"],
    [[{ ...site, description: 3 }], "$[0].description"],
    [[{ ...site, url: null }], "$[0].url"],
    [[{ ...site, url: "/relative" }], "$[0].url"],
    [[{ ...site, url: "javascript:alert(1)" }], "$[0].url"],
    [[{ ...site, url: "ftp://example.com/" }], "$[0].url"],
    [[{ ...site, url: "https:example.com" }], "$[0].url"],
    [[{ ...site, url: " https://example.com/" }], "$[0].url"],
    [[site, site], "$[1].url"],
    [[site, { ...site, url: "https://EXAMPLE.com:443" }], "$[1].url"],
  ])("rejects invalid data without returning a partial list (%#)", (value, field) => {
    expect(() => parseXSites(JSON.stringify(value))).toThrow(
      expect.objectContaining({ code: "SCHEMA", field }),
    );
  });

  it("does not expose malformed JSON values in errors", () => {
    expect(() => parseXSites('{"private-value":')).toThrow(XSitesError);
    try {
      parseXSites('{"private-value":');
    } catch (error) {
      expect(error).toMatchObject({ code: "JSON", field: "$" });
      expect(String(error)).not.toContain("private-value");
    }
  });
});
