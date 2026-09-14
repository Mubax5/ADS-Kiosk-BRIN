import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashPassword } from "../auth/password.js";
import { openDatabase } from "../db/database.js";
import { migrate } from "../db/migrate.js";
import { seedInitialContent } from "../db/seed.js";
import { createSettingsService } from "../services/settingsService.js";
import { createPublishService } from "../publish/publishService.js";

async function createUser(db: ReturnType<typeof openDatabase>, username: string, role: "admin" | "editor", canPublish = false) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users(id, username, password_hash, role, can_publish, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, username, await hashPassword("correct-password"), role, canPublish ? 1 : 0, now, now);
  return id;
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, username: string) {
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username, password: "correct-password" } });
  const raw = response.headers["set-cookie"];
  return {
    cookie: (Array.isArray(raw) ? raw[0] : raw)!.split(";", 1)[0]!,
    csrf: response.json().csrfToken as string,
  };
}

function setupDb() {
  const db = openDatabase(":memory:");
  migrate(db);
  seedInitialContent(db);
  return db;
}

describe("publishing and kiosk device API", () => {
  it("publishes immutable snapshots and rollback creates a new version", async () => {
    const db = setupDb();
    const adminId = await createUser(db, "admin", "admin", true);
    const settings = createSettingsService(db);
    const service = createPublishService(db, settings);

    const v1 = service.publish(adminId);
    db.prepare("UPDATE menu_items SET name = 'RADMON 2', updated_at = ? WHERE sort_order = 1").run(new Date().toISOString());
    settings.incrementDraftRevision(adminId);
    const v2 = service.publish(adminId);

    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(service.get(1)?.menuItems[0]?.name).toBe("RADMON");
    expect(service.get(2)?.menuItems[0]?.name).toBe("RADMON 2");

    const v3 = service.rollback(1, adminId);
    expect(v3.version).toBe(3);
    expect(v3.menuItems[0]?.name).toBe("RADMON");
    expect(service.get(1)?.menuItems[0]?.name).toBe("RADMON");
    db.close();
  });

  it("rejects an Editor without publish permission", async () => {
    const db = setupDb();
    await createUser(db, "editor", "editor", false);
    const app = await buildApp({
      db,
      cookieSecret: "test-cookie-secret-that-is-long-enough",
      cookieSecure: false,
      sessionTtlHours: 8,
      kioskDeviceId: "kiosk-main",
      kioskDeviceToken: "test-device-token-that-is-long-and-random",
    });
    const editor = await login(app, "editor");
    const response = await app.inject({ method: "POST", url: "/api/v1/admin/publish", headers: { cookie: editor.cookie, "x-csrf-token": editor.csrf } });
    expect(response.statusCode).toBe(403);
    await app.close();
    db.close();
  });

  it("requires a valid device bearer token and records heartbeat status", async () => {
    const db = setupDb();
    const adminId = await createUser(db, "admin", "admin", true);
    const settings = createSettingsService(db);
    createPublishService(db, settings).publish(adminId);
    const token = "test-device-token-that-is-long-and-random";
    const app = await buildApp({
      db,
      cookieSecret: "test-cookie-secret-that-is-long-enough",
      cookieSecure: false,
      sessionTtlHours: 8,
      kioskDeviceId: "kiosk-main",
      kioskDeviceToken: token,
    });

    expect((await app.inject({ method: "GET", url: "/api/v1/kiosk/manifest" })).statusCode).toBe(401);
    const manifest = await app.inject({ method: "GET", url: "/api/v1/kiosk/manifest", headers: { authorization: `Bearer ${token}` } });
    expect(manifest.statusCode).toBe(200);
    expect(manifest.json().version).toBe(1);

    const heartbeat = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/heartbeat",
      headers: { authorization: `Bearer ${token}` },
      payload: { softwareVersion: "0.1.0", activeVersion: 1, lastSyncStatus: "ok" },
    });
    expect(heartbeat.statusCode).toBe(204);

    const row = db.prepare("SELECT credential_hash, software_version, current_version, last_sync_status, last_seen_at FROM kiosk_devices WHERE id = ?").get("kiosk-main") as {
      credential_hash: string; software_version: string; current_version: number; last_sync_status: string; last_seen_at: string;
    };
    expect(row.credential_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(row.software_version).toBe("0.1.0");
    expect(row.current_version).toBe(1);
    expect(row.last_sync_status).toBe("ok");
    expect(Date.parse(row.last_seen_at)).not.toBeNaN();
    await app.close();
    db.close();
  });
});
