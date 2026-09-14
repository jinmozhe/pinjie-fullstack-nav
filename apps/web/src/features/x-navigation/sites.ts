export interface XSite {
  name: string;
  url: string;
  description: string;
}

type XSitesErrorCode = "CONFIG" | "READ" | "JSON" | "SCHEMA";

export class XSitesError extends Error {
  readonly code: XSitesErrorCode;
  readonly field: string;

  constructor(code: XSitesErrorCode, field: string) {
    super("站点列表暂时无法加载，请稍后重新加载。");
    this.name = "XSitesError";
    this.code = code;
    this.field = field;
  }
}

/** Only preserve known display fields; never include input values in errors. */
export function parseXSites(text: string): XSite[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new XSitesError("JSON", "$");
  }
  if (!Array.isArray(value)) throw new XSitesError("SCHEMA", "$");

  const urls = new Set<string>();
  return value.map((entry: unknown, index): XSite => {
    const field = `$[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new XSitesError("SCHEMA", field);
    }
    if (!("name" in entry) || typeof entry.name !== "string" || !entry.name.trim()) {
      throw new XSitesError("SCHEMA", `${field}.name`);
    }
    if (!("description" in entry) || typeof entry.description !== "string") {
      throw new XSitesError("SCHEMA", `${field}.description`);
    }
    if (!("url" in entry) || typeof entry.url !== "string") {
      throw new XSitesError("SCHEMA", `${field}.url`);
    }
    let url: URL;
    try {
      url = new URL(entry.url);
    } catch {
      throw new XSitesError("SCHEMA", `${field}.url`);
    }
    if (
      !/^https?:\/\//i.test(entry.url) ||
      entry.url !== entry.url.trim() ||
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      urls.has(url.href)
    ) {
      throw new XSitesError("SCHEMA", `${field}.url`);
    }
    urls.add(url.href);
    return { name: entry.name, url: entry.url, description: entry.description };
  });
}
