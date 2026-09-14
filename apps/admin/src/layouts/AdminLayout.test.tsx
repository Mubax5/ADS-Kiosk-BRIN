import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminLayout } from "./AdminLayout";

describe("AdminLayout", () => {
  it("renders the compact CMS navigation without marketing copy", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AdminLayout><div>Konten</div></AdminLayout>
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Navigasi CMS" })).toBeInTheDocument();
    expect(screen.getByText("Menu & Konten")).toBeInTheDocument();
    expect(screen.getByText("Ads")).toBeInTheDocument();
    expect(screen.queryByText(/welcome to|explore/i)).not.toBeInTheDocument();
  });
});
