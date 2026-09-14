import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashPassword } from "../auth/password.js";
import { openDatabase } from "../db/database.js";
import { migrate } from "../db/migrate.js";
import { seedInitialContent } from "../db/seed.js";

async function createAdmin(db: ReturnType<typeof openDatabase>) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users(id, username, password_hash, role, can_publish, active, created_at, updated_at)
    VALUES (?, 'admin', ?, 'admin', 1, 1, ?, ?)
  `).run(id, await hashPassword("correct-password"), now, now);
}

async function login(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username: "admin", password: "correct-password" } });
  const raw = response.headers["set-cookie"];
  return (Array.isArray(raw) ? raw[0] : raw)!.split(";", 1)[0]!;
}

describe("admin preview manifest", () => {
  it("requires a CMS session and returns the current draft rather than the last published snapshot", async () => {
    const db = openDatabase(":memory:");
    migrate(db);
    seedInitialContent(db);
    await createAdmin(db);
    const app = await buildApp({
      db,
      cookieSecret: "test-cookie-secret-that-is-long-enough",
      cookieSecure: false,
      sessionTtlHours: 8,
      kioskDeviceToken: "test-device-token-that-is-long-and-random",
    });

    expect((await app.inject({ method: "GET", url: "/api/v1/admin/preview-manifest" })).statusCode).toBe(401);

    db.prepare("UPDATE menu_items SET name = 'RADMON Draft', content_config_json = ?, updated_at = ? WHERE sort_order = 1")
      .run(JSON.stringify({ type: "text", title: "RADMON Draft", body: "Draft terbaru" }), new Date().toISOString());

    const cookie = await login(app);
    const response = await app.inject({ method: "GET", url: "/api/v1/admin/preview-manifest", headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json().menuItems[0].name).toBe("RADMON Draft");
    expect(response.json().menuItems[0].content.body).toBe("Draft terbaru");

    await app.close();
    db.close();
  });
});
