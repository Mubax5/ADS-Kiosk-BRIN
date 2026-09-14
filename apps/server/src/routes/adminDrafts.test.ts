import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashPassword } from "../auth/password.js";
import { openDatabase } from "../db/database.js";
import { migrate } from "../db/migrate.js";
import { seedInitialContent } from "../db/seed.js";

async function createUser(db: ReturnType<typeof openDatabase>, input: { username: string; role: "admin" | "editor"; canPublish?: boolean }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users(id, username, password_hash, role, can_publish, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, input.username, await hashPassword("correct-password"), input.role, input.canPublish ? 1 : 0, now, now);
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

async function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  seedInitialContent(db);
  await createUser(db, { username: "admin", role: "admin", canPublish: true });
  await createUser(db, { username: "editor", role: "editor" });
  const app = await buildApp({ db, cookieSecret: "test-cookie-secret-that-is-long-enough", cookieSecure: false, sessionTtlHours: 8 });
  return { app, db, admin: await login(app, "admin"), editor: await login(app, "editor") };
}

const headers = (session: { cookie: string; csrf: string }) => ({ cookie: session.cookie, "x-csrf-token": session.csrf });

describe("CMS draft APIs", () => {
  it("lets an Editor update valid menu content and marks the draft dirty", async () => {
    const { app, editor, admin } = await setup();
    const list = await app.inject({ method: "GET", url: "/api/v1/admin/menu-items", headers: { cookie: editor.cookie } });
    expect(list.statusCode).toBe(200);
    const item = list.json().items[0];

    const updated = { ...item, contentType: "text", content: { type: "text", title: item.name, body: "Informasi terbaru" }, mediaId: null };
    const save = await app.inject({ method: "PUT", url: `/api/v1/admin/menu-items/${item.id}`, headers: headers(editor), payload: updated });
    expect(save.statusCode).toBe(200);

    const dashboard = await app.inject({ method: "GET", url: "/api/v1/admin/dashboard", headers: { cookie: admin.cookie } });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json().hasUnpublishedChanges).toBe(true);
    await app.close();
  });

  it("rejects an invalid content configuration with 400", async () => {
    const { app, editor } = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/menu-items",
      headers: headers(editor),
      payload: {
        id: randomUUID(), name: "Invalid", description: null, contentType: "website",
        content: { type: "website", url: "javascript:alert(1)", title: "Invalid" },
        mediaId: null, active: true, sortOrder: 99,
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("allows only Admin to manage users and settings", async () => {
    const { app, editor, admin } = await setup();
    expect((await app.inject({ method: "GET", url: "/api/v1/admin/users", headers: { cookie: editor.cookie } })).statusCode).toBe(403);

    const badSetting = await app.inject({
      method: "PUT", url: "/api/v1/admin/settings", headers: headers(admin), payload: { sessionTimeoutSeconds: 10 },
    });
    expect(badSetting.statusCode).toBe(400);

    const goodSetting = await app.inject({
      method: "PUT", url: "/api/v1/admin/settings", headers: headers(admin), payload: { sessionTimeoutSeconds: 90, deviceDisplayName: "Kiosk Lobby" },
    });
    expect(goodSetting.statusCode).toBe(200);
    expect(goodSetting.json().sessionTimeoutSeconds).toBe(90);
    await app.close();
  });
});
