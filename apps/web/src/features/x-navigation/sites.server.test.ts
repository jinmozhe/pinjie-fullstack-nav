// @vitest-environment node
import * as fs from "node:fs/promises";
import type * as fsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof fsPromises>("node:fs/promises");
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

import { loadXSites } from "./sites.server";

const original = [{ name: "原站点", url: "https://original.example/", description: "原简介" }];
const updated = [{ name: "新站点", url: "http://updated.example/", description: "新简介" }];
let directory: string;
let file: string;

beforeEach(async () => {
  directory = await fs.mkdtemp(join(tmpdir(), "pinjie-x-sites-"));
  file = join(directory, "x-sites.json");
  vi.spyOn(globalThis.console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(directory, { recursive: true, force: true });
});

describe("loadXSites", () => {
  it("reads the configured file again after atomic replacement and restoration", async () => {
    vi.stubEnv("X_SITES_FILE", file);
    await fs.writeFile(file, JSON.stringify(original), "utf8");
    expect(await loadXSites()).toEqual(original);
    const next = join(directory, "x-sites.next.json");
    await fs.writeFile(next, JSON.stringify(updated), "utf8");
    await fs.rename(next, file);
    expect(await loadXSites()).toEqual(updated);
    await fs.writeFile(next, JSON.stringify(original), "utf8");
    await fs.rename(next, file);
    expect(await loadXSites()).toEqual(original);
    await fs.writeFile(file, "[]", "utf8");
    expect(await loadXSites()).toEqual([]);
  });

  it("does not serve stale data after corruption, and recovers after repair", async () => {
    await fs.writeFile(file, JSON.stringify(original), "utf8");
    expect(await loadXSites(file)).toEqual(original);
    await fs.writeFile(file, "invalid-private-value", "utf8");
    await expect(loadXSites(file)).rejects.toMatchObject({ code: "JSON", field: "$" });
    expect(globalThis.console.error).toHaveBeenCalledWith("[x-navigation] load_failed", {
      code: "JSON", field: "$",
    });
    expect(JSON.stringify(vi.mocked(globalThis.console.error).mock.calls)).not.toContain("invalid-private-value");
    await fs.writeFile(file, JSON.stringify(updated), "utf8");
    expect(await loadXSites(file)).toEqual(updated);
  });

  it("rejects missing configuration and relative paths", async () => {
    vi.stubEnv("X_SITES_FILE", undefined);
    await expect(loadXSites()).rejects.toMatchObject({ code: "CONFIG" });
    await expect(loadXSites("data/x-sites.json")).rejects.toMatchObject({ code: "CONFIG" });
  });

  it("reports an unreadable file without leaking its path", async () => {
    await expect(loadXSites(file)).rejects.toMatchObject({ code: "READ" });
    expect(JSON.stringify(vi.mocked(globalThis.console.error).mock.calls)).not.toContain(directory);
  });

  it("propagates permission failure as a safe read error", async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(
      Object.assign(new Error("EACCES: private path"), { code: "EACCES" }),
    );
    await expect(loadXSites(file)).rejects.toMatchObject({ code: "READ", field: "X_SITES_FILE" });
    expect(JSON.stringify(vi.mocked(globalThis.console.error).mock.calls)).not.toContain("private path");
  });
});
