import { expect, test } from "@playwright/test";

import {
  expectCookieProfile,
  expectNoClientTokenPersistence,
  expectPageQuality,
  uniqueUsername,
} from "./helpers";

const adminUsername = process.env.E2E_ADMIN_USERNAME ?? "stage-admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "stage-c-admin-password-2026";
const userPassword = "stage-c-user-password-2026";
const limitedAdminPassword = "stage-c-limited-password-2026";
const avatarPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKz50AAAAASUVORK5CYII=",
  "base64",
);

test.describe("stage C cross-stack journeys", () => {
  test("Web registers a user, manages the account, and signs out without exposing tokens", async ({ page }) => {
    test.skip(!test.info().project.name.startsWith("web"), "Web journey runs in Web projects");
    const username = uniqueUsername("web", test.info().project.name);
    await page.goto("/register");
    await page.getByLabel("用户名").fill(username);
    await page.getByLabel(/显示名称/).fill("Stage C Browser User");
    await page.getByLabel(/邮箱/).fill(`${username}@example.test`);
    await page.getByLabel("密码").fill(userPassword);
    const registrationResponsePromise = page
      .waitForResponse(
        (response) => response.url().endsWith("/api/v1/auth/register") && response.request().method() === "POST",
      )
      .then(async (response) => ({ ok: response.ok(), body: await response.json() }));
    await page.getByRole("button", { name: /注册并登录/ }).click();
    const registrationResponse = await registrationResponsePromise;
    expect(registrationResponse.ok).toBe(true);
    const registrationBody = JSON.stringify(registrationResponse.body);
    expect(registrationBody).not.toMatch(/access_token|refresh_token/i);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "用户中心" })).toBeVisible();

    await expectCookieProfile(page, {
      access: "pinjie_web_access",
      refresh: "pinjie_web_refresh",
      csrf: "pinjie_web_csrf",
    });
    await expectNoClientTokenPersistence(page);
    await expectPageQuality(page);

    await page.goto("/");
    const siteProfileResponse = await page.request.get("/api/v1/system/site-profile");
    expect(siteProfileResponse.ok()).toBe(true);
    const siteName = (await siteProfileResponse.json()).data.name as string;
    await expect(page.getByRole("link", { name: `${siteName}首页`, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /管理员登录/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "创建账户" })).toHaveCount(0);
    await expect(page.getByText("Stage C Browser User", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
    await expectNoClientTokenPersistence(page);
    await expectPageQuality(page);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "用户中心" })).toBeVisible();

    await page.getByLabel("显示名称").fill("Stage C Updated User");
    await page.getByRole("button", { name: "保存资料" }).press("Enter");
    await expect(page.getByRole("status")).toContainText("个人资料已保存");
    await page.getByRole("button", { name: /登录设备/ }).click();
    await expect(page.getByText("当前设备")).toBeVisible();
    await page.getByRole("button", { name: "退出" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Admin records privileged work and rejects an administrator without permissions", async ({ page, request }) => {
    test.skip(!test.info().project.name.startsWith("admin"), "Admin journey runs in Admin projects");
    const limitedUsername = uniqueUsername("limited", test.info().project.name);
    await page.goto("/login");
    const origin = new URL(page.url()).origin;
    const loginResponse = await request.post(`${origin}/api/v1/admin/auth/login`, {
      headers: { Origin: origin },
      data: { username: adminUsername, password: adminPassword },
    });
    expect(loginResponse.ok()).toBe(true);
    expect(loginResponse.headers()["content-type"]).toContain("application/json");
    expect(JSON.stringify(await loginResponse.json())).not.toMatch(/access_token|refresh_token/i);
    await page.getByLabel("用户名").fill(adminUsername);
    await page.getByLabel("密码").fill(adminPassword);
    await page.getByRole("button", { name: /登\s*录/ }).click();
    await expect(page.getByRole("heading", { name: "欢迎使用 Pinjie Console" })).toBeVisible();

    const csrf = await expectCookieProfile(page, {
      access: "pinjie_admin_access",
      refresh: "pinjie_admin_refresh",
      csrf: "pinjie_admin_csrf",
    });
    await expectNoClientTokenPersistence(page);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible();
    await expectPageQuality(page);

    await page.goto("/account/settings");
    const uploadResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/v1/assets/upload") && response.request().method() === "POST",
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: avatarPng,
    });
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.ok()).toBe(true);
    const uploadedAsset = (await uploadResponse.json()).data as { url: string };
    const avatarPreview = page.getByRole("tabpanel").locator(`img[src="${uploadedAsset.url}"]`);
    await expect(avatarPreview).toBeVisible();

    const profileResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/v1/admin/auth/profile") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "更新基本信息" }).click();
    expect((await profileResponsePromise).ok()).toBe(true);
    await page.waitForLoadState("domcontentloaded");
    await expect(avatarPreview).toBeVisible();
    await page.reload();
    await expect(avatarPreview).toBeVisible();

    for (const assetOrigin of [origin, "http://127.0.0.1:3000"]) {
      const assetResponse = await page.request.get(`${assetOrigin}${uploadedAsset.url}`);
      expect(assetResponse.ok()).toBe(true);
      expect(assetResponse.headers()["content-type"]).toBe("image/png");
      expect(assetResponse.headers()["x-content-type-options"]).toBe("nosniff");
      expect((await assetResponse.body()).byteLength).toBeGreaterThan(0);
    }
    await expectPageQuality(page);

    const commonHeaders = { Origin: origin, "X-CSRF-Token": csrf };
    const createResponse = await page.request.post(`${origin}/api/v1/admin/admins`, {
      headers: commonHeaders,
      data: {
        username: limitedUsername,
        initial_password: limitedAdminPassword,
        display_name: "Limited E2E Admin",
        is_active: true,
        is_superuser: false,
        role_ids: [],
      },
    });
    expect(createResponse.ok()).toBe(true);

    await page.goto("/security");
    await page.getByRole("tab", { name: "审计事件" }).click();
    await expect(page.getByText("admins:create").first()).toBeVisible();

    const logoutResponse = await page.request.post(`${origin}/api/v1/admin/auth/logout`, {
      headers: commonHeaders,
    });
    expect(logoutResponse.ok()).toBe(true);
    await page.goto("/login");
    await page.getByLabel("用户名").fill(limitedUsername);
    await page.getByLabel("密码").fill(limitedAdminPassword);
    await page.getByRole("button", { name: /登\s*录/ }).click();
    await expect(page.getByRole("heading", { name: "欢迎使用 Pinjie Console" })).toBeVisible();
    await page.goto("/users");
    await expect(page.getByText("无权访问")).toBeVisible();

    const deniedResponse = await page.request.get(`${origin}/api/v1/admin/users`);
    expect(deniedResponse.status()).toBe(403);
    expect((await deniedResponse.json()).code).toBe("PERMISSION_DENIED");
    await expectNoClientTokenPersistence(page);
  });
});
