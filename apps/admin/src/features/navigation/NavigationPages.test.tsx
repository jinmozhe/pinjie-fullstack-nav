import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/PageFrame", () => ({
  PageFrame: ({ title, children }: { title: string; children: ReactNode }) => <section><h1>{title}</h1>{children}</section>,
}));
vi.mock("./TaxonomyManager", () => ({ TaxonomyManager: ({ kind }: { kind: string }) => <div>taxonomy:{kind}</div> }));
vi.mock("./SitesManager", () => ({ SitesManager: ({ deleted }: { deleted: boolean }) => <div>sites:{String(deleted)}</div> }));

import CategoriesPage from "./CategoriesPage";
import NavigationPage from "./NavigationPage";
import TagsPage from "./TagsPage";

describe("navigation page composition", () => {
  it("renders category and tag managers in their page frames", () => {
    const { unmount } = render(<CategoriesPage />);
    expect(screen.getByRole("heading", { name: "分类管理" })).toBeInTheDocument();
    expect(screen.getByText("taxonomy:categories")).toBeInTheDocument();
    unmount();
    render(<TagsPage />);
    expect(screen.getByRole("heading", { name: "标签管理" })).toBeInTheDocument();
    expect(screen.getByText("taxonomy:tags")).toBeInTheDocument();
  });

  it("renders both active and recycle site tabs", () => {
    render(<NavigationPage />);
    expect(screen.getByRole("heading", { name: "站点管理" })).toBeInTheDocument();
    expect(screen.getByText("sites:false")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "回收站" }));
    expect(screen.getByText("sites:true")).toBeInTheDocument();
  });
});
