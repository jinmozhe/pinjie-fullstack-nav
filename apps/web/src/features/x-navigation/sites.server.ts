import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { parseXSites, XSitesError } from "./sites";
import type { XSite } from "./sites";

/** Server filesystem entry point. Each call opens the current file, including after rename. */
export async function loadXSites(filePath = process.env.X_SITES_FILE): Promise<XSite[]> {
  try {
    if (!filePath || !isAbsolute(filePath)) {
      throw new XSitesError("CONFIG", "X_SITES_FILE");
    }
    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch {
      throw new XSitesError("READ", "X_SITES_FILE");
    }
    return parseXSites(content);
  } catch (error) {
    if (error instanceof XSitesError) {
      globalThis.console.error("[x-navigation] load_failed", {
        code: error.code,
        field: error.field,
      });
    }
    throw error;
  }
}
