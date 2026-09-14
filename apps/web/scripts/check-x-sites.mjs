import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { parseXSites, XSitesError } from "../src/features/x-navigation/sites.ts";

try {
  const file = process.argv[2];
  if (process.argv.length !== 3 || !file || !isAbsolute(file)) {
    throw new XSitesError("CONFIG", "file_argument");
  }
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    throw new XSitesError("READ", "file_argument");
  }
  const sites = parseXSites(content);
  globalThis.console.log(`JSON 校验通过：${sites.length} 个站点。`);
} catch (error) {
  if (error instanceof XSitesError) {
    globalThis.console.error(`JSON 校验失败：${error.code}，位置 ${error.field}。`);
  } else {
    globalThis.console.error("JSON 校验失败：未知错误。");
  }
  process.exitCode = 1;
}
