import type { UserPrincipalOut } from "@pinjie/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/test/setup";

import { Providers } from "../app/providers";
import { assetApi } from "../lib/api/assets";
import { fetchRegistrationState } from "../lib/api/server";
import { AccountCenter } from "./account/AccountCenter";
import { AccountSessionRecovery } from "./account/AccountSessionRecovery";
import { AuthForm } from "./auth/AuthForm";
import { webAuthApi } from "./auth/api";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

const now = "2026-08-15T00:00:00Z";
const initialUser: UserPrincipalOut = { id: "01900000-0000-7000-8000-000000000002", username: "browser-user", display_name: "Browser User", email: "browser@example.test", avatar: null, is_active: true, created_at: now, updated_at: now };

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("stage C web account", () => {
  beforeEach(() => { replace.mockReset(); refresh.mockReset(); window.history.replaceState({}, "", "/"); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("preserves an intentional login navigation when a protected request returns late", () => {
    window.history.replaceState({}, "", "/login");
    render(<Providers><p>登录页</p></Providers>);
    act(() => window.dispatchEvent(new Event("pinjie:session-expired")));
    expect(replace).not.toHaveBeenCalled();

    window.history.replaceState({}, "", "/account");
    act(() => window.dispatchEvent(new Event("pinjie:session-expired")));
    expect(replace).toHaveBeenCalledWith("/login?reason=session-expired");
    expect(refresh).toHaveBeenCalled();
  });

  it("refreshes an expired SSR account session once", async () => {
    render(<AccountSessionRecovery />);
    expect(screen.getByRole("status")).toHaveTextContent("正在恢复会话");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to login when SSR account session recovery fails", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({ code: "AUTH_REQUIRED", message: "会话已失效" }, { status: 401 }),
      ),
    );
    render(<AccountSessionRecovery />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?reason=session-required"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([429, 503])("keeps SSR recovery retryable after a temporary %s failure", async (status) => {
    let calls = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ code: status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE", message: "会话服务暂不可用" }, { status })
          : HttpResponse.json({ code: "OK", data: {} });
      }),
    );
    const user = userEvent.setup();
    render(<AccountSessionRecovery />);
    expect(await screen.findByRole("alert")).toHaveTextContent("会话服务暂不可用");
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(calls).toBe(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it("submits the login form and enters the account center", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText("用户名"), "browser-user");
    await user.type(screen.getByLabelText("密码"), "stage-c-user-password");
    await user.click(screen.getByRole("button", { name: /登录/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"));
  });

  it("shows the complete registration fields", () => {
    renderWithQuery(<AuthForm mode="register" />);
    expect(screen.getByLabelText(/显示名称/)).toBeInTheDocument();
    expect(screen.getByLabelText(/邮箱/)).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toHaveAttribute("minlength", "6");
    expect(screen.getByLabelText("密码")).toHaveAttribute("maxlength", "64");
    expect(screen.getByText("至少 6 个字符，最多 64 个字符。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /注册并登录/ })).toBeInTheDocument();
  });

  it("hides the registration link when public registration is unavailable", () => {
    renderWithQuery(<AuthForm mode="login" registrationEnabled={false} />);

    expect(screen.queryByRole("link", { name: "立即注册" })).not.toBeInTheDocument();
  });

  it("reads enabled, disabled, and unavailable public registration states", async () => {
    const originalBaseUrl = process.env.BACKEND_INTERNAL_URL;
    process.env.BACKEND_INTERNAL_URL = "http://localhost:3000";
    try {
      expect(await fetchRegistrationState()).toBe("enabled");
      server.use(
        http.get("http://localhost:3000/api/v1/system/capabilities", () => HttpResponse.json({
          code: "OK",
          message: "操作成功",
          data: { registration_enabled: false },
          request_id: "test-request",
        })),
      );
      expect(await fetchRegistrationState()).toBe("disabled");
      server.use(
        http.get("http://localhost:3000/api/v1/system/capabilities", () =>
          HttpResponse.json({ code: "SERVICE_UNAVAILABLE", message: "服务不可用" }, { status: 503 })),
      );
      expect(await fetchRegistrationState()).toBe("unavailable");
    } finally {
      if (originalBaseUrl === undefined) delete process.env.BACKEND_INTERNAL_URL;
      else process.env.BACKEND_INTERNAL_URL = originalBaseUrl;
    }
  });

  it("shows the backend message and retry delay when registration is rate limited", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/register", () => HttpResponse.json(
        { code: "RATE_LIMITED", message: "注册请求过于频繁" },
        { status: 429, headers: { "Retry-After": "30" } },
      )),
    );
    const user = userEvent.setup();
    renderWithQuery(<AuthForm mode="register" />);
    await user.type(screen.getByLabelText("用户名"), "browser-user");
    await user.type(screen.getByLabelText("密码"), "stage-c-user-password");
    await user.click(screen.getByRole("button", { name: /注册并登录/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("注册请求过于频繁，请在 30 秒后重试");
  });

  it("updates profile and loads current sessions", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);
    const displayName = screen.getByLabelText("显示名称");
    await user.clear(displayName);
    await user.type(displayName, "Updated User");
    await user.click(screen.getByRole("button", { name: "保存资料" }));
    expect(await screen.findByRole("status")).toHaveTextContent("个人资料已保存");
    await user.click(screen.getByRole("button", { name: /登录设备/ }));
    expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("当前设备")).toBeInTheDocument();
  });

  it("shows profile update failures without losing the form", async () => {
    server.use(
      http.patch("http://localhost:3000/api/v1/users/me", () => HttpResponse.json(
        { code: "UPDATE_FAILED", message: "资料暂时无法保存" },
        { status: 503 },
      )),
    );
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);
    await user.click(screen.getByRole("button", { name: "保存资料" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("资料暂时无法保存");
    expect(screen.getByLabelText("显示名称")).toBeInTheDocument();
  });

  it("uploads and binds a user-owned avatar asset", async () => {
    const upload = vi.spyOn(assetApi, "upload").mockResolvedValue({
      id: "01900000-0000-7000-8000-000000000020",
      uploader_type: "user",
      uploader_id: initialUser.id,
      storage_driver: "local",
      file_key: "avatar/20260825/avatar.png",
      original_name: "avatar.png",
      mime_type: "image/png",
      file_size: 16,
      file_hash: "b".repeat(64),
      url: "/static/uploads/avatar/20260825/avatar.png",
      scene: "avatar",
      created_at: now,
      updated_at: now,
    });
    const updateAvatar = vi.spyOn(webAuthApi, "updateAvatar").mockResolvedValue({ ...initialUser, avatar: "/static/uploads/avatar/20260825/avatar.png" });
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);

    await user.upload(screen.getByLabelText("选择图片文件"), new globalThis.File(["png-content"], "avatar.png", { type: "image/png" }));

    await waitFor(() => expect(updateAvatar).toHaveBeenCalledWith("01900000-0000-7000-8000-000000000020"));
    expect(upload).toHaveBeenCalledWith(expect.any(globalThis.File), "avatar");
    expect(await screen.findByText("头像已更新")).toBeInTheDocument();
  });

  it("shows a binding failure after avatar upload", async () => {
    vi.spyOn(assetApi, "upload").mockResolvedValue({
      id: "01900000-0000-7000-8000-000000000021",
      uploader_type: "user",
      uploader_id: initialUser.id,
      storage_driver: "local",
      file_key: "avatar/20260825/avatar.png",
      original_name: "avatar.png",
      mime_type: "image/png",
      file_size: 16,
      file_hash: "c".repeat(64),
      url: "/static/uploads/avatar/20260825/avatar.png",
      scene: "avatar",
      created_at: now,
      updated_at: now,
    });
    vi.spyOn(webAuthApi, "updateAvatar").mockRejectedValue(new Error("头像绑定失败"));
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);

    await user.upload(screen.getByLabelText("选择图片文件"), new globalThis.File(["png-content"], "avatar.png", { type: "image/png" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("头像绑定失败");
  });

  it("removes the avatar through the binding endpoint", async () => {
    const currentAvatar = { ...initialUser, avatar: "/static/uploads/avatar/current.png" };
    server.use(
      http.get("http://localhost:3000/api/v1/users/me", () =>
        HttpResponse.json({ code: "OK", message: "操作成功", data: currentAvatar }),
      ),
    );
    const updateAvatar = vi.spyOn(webAuthApi, "updateAvatar").mockResolvedValue({ ...currentAvatar, avatar: null });
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={currentAvatar} />);

    await user.click(screen.getByRole("button", { name: "移除头像" }));

    await waitFor(() => expect(updateAvatar).toHaveBeenCalledWith(null));
    expect(await screen.findByText("头像已更新")).toBeInTheDocument();
  });

  it("falls back to the display-name initial when an avatar is broken", () => {
    const currentAvatar = { ...initialUser, avatar: "/static/uploads/avatar/current.png" };
    renderWithQuery(<AccountCenter initialUser={currentAvatar} />);

    const images = screen.getAllByAltText("Browser User头像");
    const image = images[0];
    if (!image) throw new Error("头像图片未渲染");
    fireEvent.error(image);

    expect(screen.getAllByText("B").length).toBeGreaterThanOrEqual(1);
  });

  it("validates password and account deletion workflows", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);
    await user.click(screen.getByRole("button", { name: /密码安全/ }));
    expect(screen.getByLabelText("当前密码")).toHaveAttribute("maxlength", "64");
    expect(screen.getByLabelText("新密码")).toHaveAttribute("minlength", "6");
    expect(screen.getByLabelText("新密码")).toHaveAttribute("maxlength", "64");
    await user.type(screen.getByLabelText("当前密码"), "stage-c-user-password");
    await user.type(screen.getByLabelText("新密码"), "stage-c-user-password-next");
    await user.click(screen.getByRole("button", { name: "确认修改" }));
    expect(await screen.findByText("密码已修改，当前会话已更新，其他会话已撤销")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith("/login?reason=password-changed");
  });

  it("revokes sessions and signs out", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);
    await user.click(screen.getByRole("button", { name: /登录设备/ }));
    expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "撤销其他设备" }));
    await user.click(screen.getByRole("button", { name: "退出" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("aborts an in-flight session request before signing out", async () => {
    let sessionSignal: globalThis.AbortSignal | undefined;
    const sessions = vi.spyOn(webAuthApi, "sessions").mockImplementation((signal) => {
      sessionSignal = signal;
      return new Promise(() => undefined);
    });
    try {
      const user = userEvent.setup();
      renderWithQuery(<AccountCenter initialUser={initialUser} />);
      await user.click(screen.getByRole("button", { name: /登录设备/ }));
      await waitFor(() => expect(sessionSignal).toBeDefined());
      await user.click(screen.getByRole("button", { name: "退出" }));
      await waitFor(() => expect(sessionSignal?.aborted).toBe(true));
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    } finally {
      sessions.mockRestore();
    }
  });

  it("keeps the account page available when logout fails", async () => {
    server.use(
      http.post("http://localhost:3000/api/v1/auth/logout", () =>
        HttpResponse.json({ code: "LOGOUT_FAILED", message: "退出失败，请重试" }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);
    await user.click(screen.getByRole("button", { name: "退出" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("退出失败，请重试");
    expect(replace).not.toHaveBeenCalledWith("/login");
  });

  it("shows and revokes other active sessions while retaining revoked history", async () => {
    server.use(
      http.get("http://localhost:3000/api/v1/users/me/sessions", () => HttpResponse.json({
        code: "OK",
        message: "操作成功",
        request_id: "test-request",
        data: {
          items: [
            { id: "01900000-0000-7000-8000-000000000004", device_name: null, ip_masked: null, user_agent_summary: null, created_at: now, last_seen_at: now, idle_expires_at: now, absolute_expires_at: now, is_current: false, revoked_at: null },
            { id: "01900000-0000-7000-8000-000000000005", device_name: "Old device", ip_masked: "10.0.0.*", user_agent_summary: "Old browser", created_at: now, last_seen_at: now, idle_expires_at: now, absolute_expires_at: now, is_current: false, revoked_at: now },
          ],
          page: 1,
          page_size: 100,
          total: 2,
          total_pages: 1,
        },
      })),
    );
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);
    await user.click(screen.getByRole("button", { name: /登录设备/ }));
    expect(await screen.findByText("未知设备")).toBeInTheDocument();
    expect(screen.getByText(/未知地址/)).toBeInTheDocument();
    expect(screen.getByText("已撤销")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "撤销" }));
  });

  it("deletes an account after username and password confirmation", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AccountCenter initialUser={initialUser} />);
    await user.click(screen.getByRole("button", { name: /注销账户/ }));
    await user.type(screen.getByLabelText(/输入用户名/), "browser-user");
    expect(screen.getByLabelText("当前密码")).toHaveAttribute("maxlength", "64");
    await user.type(screen.getByLabelText("当前密码"), "stage-c-user-password");
    await user.click(screen.getByRole("button", { name: /注销并移入回收站/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?reason=account-deleted"));
  });
});
