import type { PublishedManifest } from "@ads-kiosk/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KioskApp } from "./KioskApp";

const manifest: PublishedManifest = {
  version: 1,
  publishedAt: "2026-09-14T00:00:00.000Z",
  menuItems: [
    {
      id: "menu-radmon",
      name: "RADMON",
      description: null,
      contentType: "text",
      content: { type: "text", title: "RADMON", body: "Informasi RADMON" },
      mediaId: null,
      active: true,
      sortOrder: 1,
    },
    {
      id: "menu-brin",
      name: "WEB BRIN",
      description: null,
      contentType: "website",
      content: { type: "website", title: "Website BRIN", url: "https://www.brin.go.id/" },
      mediaId: null,
      active: true,
      sortOrder: 2,
    },
  ],
  ads: [],
  settings: { sessionTimeoutSeconds: 60, sessionWarningSeconds: 10, deviceDisplayName: "Kiosk Utama" },
  media: [],
};

describe("KioskApp", () => {
  it("starts in advertising mode with a clear touch call to action", () => {
    render(<KioskApp manifest={manifest} />);
    expect(screen.getByRole("button", { name: "Sentuh untuk Mulai" })).toBeInTheDocument();
    expect(screen.queryByText("Pilih layanan")).not.toBeInTheDocument();
  });

  it("opens a BRIN public-service directory after touch", () => {
    render(<KioskApp manifest={manifest} />);
    fireEvent.click(screen.getByRole("button", { name: "Sentuh untuk Mulai" }));

    expect(screen.getByLabelText("Identitas BRIN")).toHaveTextContent("Badan Riset dan Inovasi Nasional");
    expect(screen.getByRole("region", { name: "Direktori layanan BRIN" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pilih layanan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "RADMON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WEB BRIN" })).toBeInTheDocument();
    expect(screen.queryByText(/explore|welcome to/i)).not.toBeInTheDocument();
  });

  it("opens text content and can return to the menu", () => {
    render(<KioskApp manifest={manifest} />);
    fireEvent.click(screen.getByRole("button", { name: "Sentuh untuk Mulai" }));
    fireEvent.click(screen.getByRole("button", { name: "RADMON" }));

    expect(screen.getByRole("heading", { name: "RADMON" })).toBeInTheDocument();
    expect(screen.getByText("Informasi RADMON")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke Menu" }));
    expect(screen.getByRole("heading", { name: "Pilih layanan" })).toBeInTheDocument();
  });
});
