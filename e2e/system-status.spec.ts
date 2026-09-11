import { expect, test } from "@playwright/test";

import { expectNoClientTokenPersistence, expectPageQuality } from "./helpers";

test.describe("system status foundation", () => {
  test("Web renders backend availability and passes critical accessibility checks", async ({ page }) => {
    test.skip(!test.info().project.name.startsWith("web"), "Web check runs in the Web projects");
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto("/");
    const siteProfileResponse = await page.request.get("/api/v1/system/site-profile");
    expect(siteProfileResponse.ok()).toBe(true);
    const siteName = (await siteProfileResponse.json()).data.name as string;
    await expect(page.getByRole("link", { name: `${siteName}首页`, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "系统运行状态" })).toBeVisible();
    await expect(page.getByRole("link", { name: "登录" })).toBeVisible();
    await expect(page.getByRole("link", { name: "创建账户" })).toBeVisible();
    await expect(async () => {
      const availability = page.getByText("可用", { exact: true });
      if (!(await availability.isVisible())) {
        const retry = page.getByRole("button", { name: "重新检查" });
        if (await retry.isVisible()) await retry.click();
      }
      await expect(availability).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000, intervals: [500, 1_000, 2_000] });
    await expectNoClientTokenPersistence(page);
    await expectPageQuality(page);
    expect(consoleErrors).toEqual([]);
  });

  test("Admin renders the secure login entry and passes critical accessibility checks", async ({ page }) => {
    test.skip(!test.info().project.name.startsWith("admin"), "Admin check runs in the Admin projects");
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Pinjie Console" })).toBeVisible();
    await expect(page.getByLabel("用户名")).toBeVisible();
    await expectNoClientTokenPersistence(page);
    await expectPageQuality(page);
    expect(consoleErrors).toEqual([]);
  });
});
