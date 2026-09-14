import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { requireAdmin, requirePublisher } from "../auth/guards.js";
import { hashPassword } from "../auth/password.js";
import { openDatabase } from "../db/database.js";
import { migrate } from "../db/migrate.js";

async function buildTestAppWithUser(input: {
  username: string;
  password: string;
  role: "admin" | "editor";
  canPublish?: boolean;
}) {
  const db = openDatabase(":memory:");
  migrate(db);
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users(id, username, password_hash, role, can_publish, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    input.username,
    await hashPassword(input.password),
    input.role,
    input.canPublish ? 1 : 0,
    now,
    now,
  );

  const app = await buildApp({
    db,
    cookieSecret: "test-cookie-secret-that-is-long-enough",
    cookieSecure: false,
    sessionTtlHours: 8,
  });

  app.get("/__test/admin", { preHandler: requireAdmin }, async () => ({ ok: true }));
  app.get("/__test/publish", { preHandler: requirePublisher }, async () => ({ ok: true }));
  return { app, db, userId: id };
}

function cookieHeader(response: { headers: Record<string, string | string[] | undefined> }): string {
  const raw = response.headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) throw new Error("expected set-cookie header");
  return value.split(";", 1)[0]!;
}

describe("CMS authentication", () => {
  it("sets an HttpOnly server-side session and returns a CSRF token after valid login", async () => {
    const { app } = await buildTestAppWithUser({ username: "admin", password: "correct", role: "admin" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "admin", password: "correct" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(response.json().csrfToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    await app.close();
  });

  it("rejects an invalid password without creating a session", async () => {
    const { app, db } = await buildTestAppWithUser({ username: "admin", password: "correct", role: "admin" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "admin", password: "wrong" },
    });

    expect(response.statusCode).toBe(401);
    expect((db.prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }).count).toBe(0);
    await app.close();
  });

  it("enforces Admin and explicit publisher permissions", async () => {
    const editor = await buildTestAppWithUser({ username: "editor", password: "correct", role: "editor" });
    const login = await editor.app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username: "editor", password: "correct" } });
    const cookie = cookieHeader(login);

    expect((await editor.app.inject({ method: "GET", url: "/__test/admin", headers: { cookie } })).statusCode).toBe(403);
    expect((await editor.app.inject({ method: "GET", url: "/__test/publish", headers: { cookie } })).statusCode).toBe(403);
    await editor.app.close();

    const publisher = await buildTestAppWithUser({ username: "publisher", password: "correct", role: "editor", canPublish: true });
    const publisherLogin = await publisher.app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username: "publisher", password: "correct" } });
    expect((await publisher.app.inject({ method: "GET", url: "/__test/publish", headers: { cookie: cookieHeader(publisherLogin) } })).statusCode).toBe(200);
    await publisher.app.close();
  });

  it("requires CSRF for logout and invalidates the session when the token is valid", async () => {
    const { app } = await buildTestAppWithUser({ username: "admin", password: "correct", role: "admin" });
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username: "admin", password: "correct" } });
    const cookie = cookieHeader(login);
    const csrfToken = login.json().csrfToken as string;

    const noCsrf = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie } });
    expect(noCsrf.statusCode).toBe(403);

    const logout = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie, "x-csrf-token": csrfToken } });
    expect(logout.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie } })).statusCode).toBe(401);
    await app.close();
  });
});
