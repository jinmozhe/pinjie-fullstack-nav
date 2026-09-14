import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { XNavigation } from "./XNavigation";
import XNavigationError from "@/app/x/error";

describe("XNavigation", () => {
  it("shows the current count, content and external link behavior", () => {
    render(<XNavigation sites={[{ name: "示例", url: "https://example.com/", description: "站点简介" }]} />);
    expect(screen.getByText("1 个站点")).toBeInTheDocument();
    expect(screen.getByText("站点简介")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "访问 示例（新窗口）" });
    expect(link).toHaveAttribute("href", "https://example.com/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows an empty state without implementation instructions", () => {
    render(<XNavigation sites={[]} />);
    expect(screen.getByText("暂无站点")).toBeInTheDocument();
    expect(screen.queryByText(/page\.tsx|SITES/)).not.toBeInTheDocument();
  });

  it("shows a distinct failure state and reload action", () => {
    render(<XNavigationError />);
    expect(screen.getByRole("alert")).toHaveTextContent("站点列表加载失败");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
    expect(screen.queryByText("暂无站点")).not.toBeInTheDocument();
  });
});
