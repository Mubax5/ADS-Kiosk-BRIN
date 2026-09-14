import { expect, test } from "@playwright/test";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z+0cAAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Parameters<typeof test>[0] extends never ? never : any) {
  await page.goto("/admin/");
  await page.getByLabel("Username").fill("e2e-admin");
  await page.getByLabel("Password").fill("e2e-password-for-tests-only");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("Admin edits content, uploads an ad, previews draft, and publishes", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Menu & Konten" }).click();
  const radmonRow = page.getByRole("row").filter({ hasText: "RADMON" }).first();
  await radmonRow.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Nama menu").fill("RADMON E2E");
  await page.getByLabel("Judul").fill("RADMON E2E");
  await page.getByLabel("Isi").fill("Konten E2E siap dibaca.");
  await page.getByRole("button", { name: "Simpan Draft" }).click();
  await expect(page.getByRole("row").filter({ hasText: "RADMON E2E" })).toBeVisible();

  await page.getByRole("button", { name: "Media" }).click();
  await page.getByLabel("Pilih file media").setInputFiles({
    name: "e2e-ad.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await expect(page.getByRole("cell", { name: "e2e-ad.png" })).toBeVisible();

  await page.getByRole("button", { name: "Ads" }).click();
  const mediaSelect = page.getByRole("combobox", { name: "Media Ads" });
  await mediaSelect.click();
  await page.getByRole("option", { name: "e2e-ad.png" }).click();
  await page.getByLabel("Durasi gambar (detik)").fill("5");
  await page.getByRole("button", { name: "Tambah ke Playlist" }).click();
  await expect(page.getByRole("row").filter({ hasText: "e2e-ad.png" })).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  const kioskPreview = page.frameLocator('iframe[title="Preview Kiosk"]');
  await expect(kioskPreview.getByRole("button", { name: "Sentuh untuk Mulai" })).toBeVisible();
  await kioskPreview.getByRole("button", { name: "Sentuh untuk Mulai" }).click();
  await expect(kioskPreview.getByRole("button", { name: "RADMON E2E" })).toBeVisible();

  await page.getByRole("button", { name: "Publish ke Kiosk" }).click();
  await expect(page.getByRole("heading", { name: /Publish versi 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Publish sekarang" }).click();
  await expect(page.getByText("Tidak ada perubahan", { exact: true })).toBeVisible();
});
