import type { MenuItem } from "@ads-kiosk/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuEditor } from "./MenuEditor";

const websiteItem: MenuItem = {
  id: "menu-1",
  name: "WEB BRIN",
  description: null,
  contentType: "website",
  content: { type: "website", url: "https://www.brin.go.id/", title: "BRIN" },
  mediaId: null,
  active: true,
  sortOrder: 1,
};

const pdfId = "3d594650-3436-46c5-858a-a818bc49b599";
const pdfItem: MenuItem = {
  id: "menu-2",
  name: "Panduan",
  description: null,
  contentType: "pdf",
  content: { type: "pdf", mediaId: pdfId, title: "Panduan" },
  mediaId: pdfId,
  active: true,
  sortOrder: 2,
};

describe("MenuEditor", () => {
  it("shows only fields that belong to the selected content type", () => {
    const { rerender } = render(<MenuEditor value={websiteItem} onSave={vi.fn()} media={[]} />);
    expect(screen.getByLabelText("URL")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pilih PDF")).not.toBeInTheDocument();

    rerender(
      <MenuEditor
        value={pdfItem}
        onSave={vi.fn()}
        media={[{ id: pdfId, originalName: "panduan.pdf", category: "pdf", mimeType: "application/pdf" }]}
      />,
    );
    expect(screen.getByLabelText("Pilih PDF")).toBeInTheDocument();
    expect(screen.queryByLabelText("URL")).not.toBeInTheDocument();
  });
});
