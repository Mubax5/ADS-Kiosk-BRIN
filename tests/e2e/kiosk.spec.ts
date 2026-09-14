import { expect, test } from "@playwright/test";
import { updateRadmonAndPublish } from "./helpers";

test("Kiosk runs the touch flow and resets an inactive visitor session", async ({ page, request }) => {
  await updateRadmonAndPublish(request, "KIOSK");

  await page.clock.install();
  await page.goto("/kiosk/");
  await expect(page.getByRole("button", { name: "Sentuh untuk Mulai" })).toBeVisible();

  await page.getByRole("button", { name: "Sentuh untuk Mulai" }).click();
  await expect(page.getByRole("heading", { name: "Pilih layanan" })).toBeVisible();
  await page.getByRole("button", { name: "RADMON KIOSK" }).click();
  await expect(page.getByRole("heading", { name: "RADMON KIOSK" })).toBeVisible();
  await expect(page.getByText("Konten KIOSK siap dibaca.")).toBeVisible();

  await page.getByRole("button", { name: "Kembali ke Menu" }).click();
  await expect(page.getByRole("heading", { name: "Pilih layanan" })).toBeVisible();

  await page.clock.fastForward(50_000);
  await expect(page.getByRole("dialog")).toContainText("Sesi akan berakhir dalam 10 detik");
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await expect(page.getByRole("heading", { name: "Pilih layanan" })).toBeVisible();

  await page.clock.fastForward(60_000);
  await expect(page.getByRole("button", { name: "Sentuh untuk Mulai" })).toBeVisible();
  await expect(page.queryByText?.("Konten KIOSK siap dibaca.") ?? page.getByText("Konten KIOSK siap dibaca.")).not.toBeVisible();
});
