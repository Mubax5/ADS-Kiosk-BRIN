import { spawn, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginApi } from "./helpers";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z+0cAAAAASUVORK5CYII=",
  "base64",
);

type Manifest = { version: number; media: Array<{ id: string; url: string }> };

async function uploadImage(request: APIRequestContext, csrf: string, name: string) {
  const response = await request.post("/api/v1/admin/media", {
    headers: { "x-csrf-token": csrf },
    multipart: { file: { name, mimeType: "image/png", buffer: PNG_1X1 } },
  });
  if (!response.ok()) throw new Error(`Upload failed: ${response.status()} ${await response.text()}`);
  return await response.json() as { id: string };
}

async function publishImageVersion(request: APIRequestContext, csrf: string, mediaId: string, suffix: string): Promise<Manifest> {
  const menuResponse = await request.get("/api/v1/admin/menu-items");
  const { items } = await menuResponse.json() as { items: Array<Record<string, unknown> & { id: string; sortOrder: number }> };
  const radmon = items.find((item) => item.sortOrder === 1);
  if (!radmon) throw new Error("Seeded RADMON menu not found");
  const save = await request.put(`/api/v1/admin/menu-items/${radmon.id}`, {
    headers: { "x-csrf-token": csrf },
    data: {
      ...radmon,
      name: `RADMON ${suffix}`,
      contentType: "image",
      content: { type: "image", mediaId, caption: `Gambar ${suffix}` },
      mediaId,
      active: true,
    },
  });
  if (!save.ok()) throw new Error(`Menu update failed: ${save.status()} ${await save.text()}`);
  const publish = await request.post("/api/v1/admin/publish", { headers: { "x-csrf-token": csrf }, data: {} });
  if (!publish.ok()) throw new Error(`Publish failed: ${publish.status()} ${await publish.text()}`);
  return await publish.json() as Manifest;
}

async function activeVersion(page: Page) {
  return page.evaluate(async () => {
    return await new Promise<number | null>((resolve, reject) => {
      const request = indexedDB.open("ads-kiosk-brin", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readonly");
        const get = tx.objectStore("state").get("activeVersion");
        get.onsuccess = () => { resolve((get.result as number | undefined) ?? null); db.close(); };
        get.onerror = () => { reject(get.error); db.close(); };
      };
    });
  });
}

test("Kiosk keeps the previous verified version on failed staging and reloads offline", async ({ page, request, context }) => {
  const csrf = await loginApi(request);

  const invalid = await request.post("/api/v1/admin/media", {
    headers: { "x-csrf-token": csrf },
    multipart: { file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("MZ-not-an-image") } },
  });
  expect(invalid.status()).toBe(415);

  const media1 = await uploadImage(request, csrf, "offline-v1.png");
  const manifest1 = await publishImageVersion(request, csrf, media1.id, "OFFLINE1");

  await page.goto("/kiosk/");
  await expect.poll(() => activeVersion(page)).toBe(manifest1.version);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Sentuh untuk Mulai" }).click();
  await expect(page.getByRole("button", { name: "RADMON OFFLINE1" })).toBeVisible();

  const media2 = await uploadImage(request, csrf, "offline-v2.png");
  const manifest2 = await publishImageVersion(request, csrf, media2.id, "OFFLINE2");
  const stagedMedia = manifest2.media.find((entry) => entry.id === media2.id);
  if (!stagedMedia) throw new Error("Published V2 media was not included in the manifest");

  await page.route(`**${stagedMedia.url}`, async (route) => route.fulfill({ status: 503, body: "interrupted" }));
  await page.reload();
  await expect.poll(() => activeVersion(page)).toBe(manifest1.version);
  await page.getByRole("button", { name: "Sentuh untuk Mulai" }).click();
  await expect(page.getByRole("button", { name: "RADMON OFFLINE1" })).toBeVisible();

  await page.unroute(`**${stagedMedia.url}`);
  await page.reload();
  await expect.poll(() => activeVersion(page)).toBe(manifest2.version);
  await page.getByRole("button", { name: "Sentuh untuk Mulai" }).click();
  await expect(page.getByRole("button", { name: "RADMON OFFLINE2" })).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Sentuh untuk Mulai" })).toBeVisible();
  await page.getByRole("button", { name: "Sentuh untuk Mulai" }).click();
  await expect(page.getByRole("button", { name: "RADMON OFFLINE2" })).toBeVisible();
  await context.setOffline(false);
});

async function waitForHealth(url: string) {
  await expect.poll(async () => {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }, { timeout: 15_000 }).toBe(true);
}

function startRestartProbe(): ChildProcess {
  return spawn("node", ["apps/server/dist/index.js"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "4174",
      DATABASE_PATH: "./data/e2e-restart/kiosk.db",
      STORAGE_PATH: "./storage-e2e-restart",
      BACKUP_PATH: "./backups-e2e-restart",
      LOG_PATH: "./logs-e2e-restart",
      RUN_LOCK_PATH: "./data/e2e-restart/server.lock",
      COOKIE_SECRET: process.env.E2E_ADMIN_PASSWORD,
      COOKIE_SECURE: "false",
      ADMIN_DIST_PATH: "./apps/admin/dist",
      KIOSK_DIST_PATH: "./apps/kiosk/dist",
    },
    stdio: "ignore",
  });
}

async function stopProbe(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}

test("Production server can restart and returns healthy after each start", async () => {
  rmSync("./data/e2e-restart", { recursive: true, force: true });
  rmSync("./storage-e2e-restart", { recursive: true, force: true });
  let server = startRestartProbe();
  try {
    await waitForHealth("http://127.0.0.1:4174/api/v1/health");
    await stopProbe(server);
    server = startRestartProbe();
    await waitForHealth("http://127.0.0.1:4174/api/v1/health");
  } finally {
    await stopProbe(server);
  }
});
