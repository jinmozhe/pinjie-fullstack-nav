import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StandardConfirmModal } from "./StandardConfirmModal";

describe("StandardConfirmModal", () => {
  it("does not execute on open or cancel", async () => {
    const onConfirm = vi.fn<() => Promise<void>>();
    const onCancel = vi.fn();
    render(<StandardConfirmModal open loading={false} title="删除目标" description="永久删除 1 项" onConfirm={onConfirm} onCancel={onCancel} />);
    const user = userEvent.setup();
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /取\s*消/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks duplicate confirmation and cancellation while awaiting the request", async () => {
    let finish: (() => void) | undefined;
    const request = new Promise<void>((resolve) => { finish = resolve; });
    const onConfirm = vi.fn(() => request);
    const onCancel = vi.fn();
    render(<StandardConfirmModal open loading={false} title="删除目标" description="永久删除 1 项" onConfirm={onConfirm} onCancel={onCancel} />);
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /确\s*定/ });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(within(dialog).getByRole("button", { name: /取\s*消/ }));
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape", keyCode: 27 });
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: /取\s*消/ })).toBeDisabled();
    await act(async () => { finish?.(); await request; });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: /取\s*消/ })).toBeEnabled());
  });

  it("keeps the dialog and business input after failure and permits retry", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("目标仍被引用"))
      .mockResolvedValueOnce(undefined);
    render(
      <StandardConfirmModal open loading={false} title="删除目标" description="永久删除 1 项" onConfirm={onConfirm} onCancel={vi.fn()}>
        <input aria-label="删除原因" defaultValue="重复资料" />
      </StandardConfirmModal>,
    );
    await user.click(screen.getByRole("button", { name: /确\s*定/ }));
    expect(await screen.findByText("目标仍被引用")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("删除原因")).toHaveValue("重复资料");
    await user.click(screen.getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("目标仍被引用")).not.toBeInTheDocument();
  });
});
