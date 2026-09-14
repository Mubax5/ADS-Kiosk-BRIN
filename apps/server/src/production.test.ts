import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { openDatabase } from "./db/database.js";
import { migrate } from "./db/migrate.js";
import { seedInitialContent } from "./db/seed.js";
import { createBackupService } from "./services/backupService.js";

describe("production hosting and recovery", () => {
  it("serves Admin and Kiosk SPAs without swallowing API 404s", async () => {
    const root = mkdtempSync(join(tmpdir(), "ads-kiosk-static-"));
    const admin = join(root, "admin");
    const kiosk = join(root, "kiosk");
    mkdirSync(join(admin, "assets"), { recursive: true });
    mkdirSync(kiosk, { recursive: true });
    writeFileSync(join(admin, "index.html"), "<h1>ADMIN SHELL</h1>");
    writeFileSync(join(admin, "assets", "app.js"), "console.log('admin')");
    writeFileSync(join(kiosk, "index.html"), "<h1>KIOSK SHELL</h1>");

    const db = openDatabase(":memory:");
    migrate(db);
    seedInitialContent(db);
    const app = await buildApp({
      db,
      cookieSecret: "test-cookie-secret-that-is-long-enough",
      cookieSecure: false,
      sessionTtlHours: 8,
      adminDistPath: admin,
      kioskDistPath: kiosk,
    });

    expect((await app.inject({ method: "GET", url: "/admin/" })).body).toContain("ADMIN SHELL");
    expect((await app.inject({ method: "GET", url: "/admin/settings" })).body).toContain("ADMIN SHELL");
    expect((await app.inject({ method: "GET", url: "/admin/assets/app.js" })).body).toContain("console.log('admin')");
    expect((await app.inject({ method: "GET", url: "/kiosk/" })).body).toContain("KIOSK SHELL");
    expect((await app.inject({ method: "GET", url: "/kiosk/anything" })).body).toContain("KIOSK SHELL");

    const missingApi = await app.inject({ method: "GET", url: "/api/v1/not-real" });
    expect(missingApi.statusCode).toBe(404);
    expect(missingApi.headers["content-type"]).toContain("application/json");
    expect(missingApi.body).not.toContain("ADMIN SHELL");
    expect(missingApi.body).not.toContain("KIOSK SHELL");

    await app.close();
    db.close();
  });

  it("backs up SQLite and media under one backup id", async () => {
    const root = mkdtempSync(join(tmpdir(), "ads-kiosk-backup-"));
    const dataDir = join(root, "data");
    const storage = join(root, "storage");
    const backupRoot = join(root, "backups");
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(join(storage, "images"), { recursive: true });
    writeFileSync(join(storage, "images", "example.txt"), "media snapshot");

    const db = openDatabase(join(dataDir, "kiosk.db"));
    migrate(db);
    seedInitialContent(db);
    const service = createBackupService({
      db,
      storagePath: storage,
      backupRoot,
      now: () => new Date("2026-09-14T05:00:00.000Z"),
    });

    const result = await service.createBackup();

    expect(result.id).toBe("20260914-050000");
    expect(existsSync(join(result.path, "kiosk.db"))).toBe(true);
    expect(readFileSync(join(result.path, "storage", "images", "example.txt"), "utf8")).toBe("media snapshot");
    db.close();
  });
});
