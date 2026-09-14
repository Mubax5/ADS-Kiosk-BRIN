import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashPassword } from "../auth/password.js";
import { openDatabase } from "../db/database.js";
import { migrate } from "../db/migrate.js";

const tempDirs: string[] = [];

async function buildAuthenticatedApp() {
  const storagePath = await mkdtemp(join(tmpdir(), "ads-kiosk-media-"));
  tempDirs.push(storagePath);
  const db = openDatabase(":memory:");
  migrate(db);
  const now = new Date().toISOString();
  const userId = randomUUID();
  db.prepare(`
    INSERT INTO users(id, username, password_hash, role, can_publish, active, created_at, updated_at)
    VALUES (?, 'admin', ?, 'admin', 1, 1, ?, ?)
  `).run(userId, await hashPassword("correct-password"), now, now);

  const app = await buildApp({
    db,
    cookieSecret: "test-cookie-secret-that-is-long-enough",
    cookieSecure: false,
    sessionTtlHours: 8,
    storagePath,
    maxUploadBytes: 1024 * 1024,
  });
  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username: "admin", password: "correct-password" } });
  const raw = login.headers["set-cookie"];
  const cookie = (Array.isArray(raw) ? raw[0] : raw)!.split(";", 1)[0]!;
  return { app, db, cookie, csrfToken: login.json().csrfToken as string, storagePath };
}

function multipart(filename: string, bytes: Buffer, mime = "application/octet-stream") {
  const boundary = `----ads-kiosk-${randomUUID()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, bytes, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function upload(app: Awaited<ReturnType<typeof buildApp>>, cookie: string, csrfToken: string, filename: string, bytes: Buffer, mime?: string) {
  const form = multipart(filename, bytes, mime);
  return app.inject({
    method: "POST",
    url: "/api/v1/admin/media",
    headers: { cookie, "x-csrf-token": csrfToken, "content-type": form.contentType },
    payload: form.payload,
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("media library", () => {
  it("stores a valid PNG under a generated name and records a SHA-256 checksum", async () => {
    const { app, cookie, csrfToken } = await buildAuthenticatedApp();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const response = await upload(app, cookie, csrfToken, "pixel.png", png, "image/png");

    expect(response.statusCode).toBe(201);
    const media = response.json();
    expect(media.originalName).toBe("pixel.png");
    expect(media.storedName).not.toContain("pixel.png");
    expect(media.storedName).toMatch(/^[0-9a-f-]+\.png$/);
    expect(media.checksum).toMatch(/^[a-f0-9]{64}$/);

    const served = await app.inject({ method: "GET", url: `/media/${media.id}` });
    expect(served.statusCode).toBe(200);
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
    expect(served.rawPayload.equals(png)).toBe(true);
    await app.close();
  });

  it("rejects an executable renamed to .png", async () => {
    const { app, cookie, csrfToken } = await buildAuthenticatedApp();
    const fakeExe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(256, 0)]);
    const response = await upload(app, cookie, csrfToken, "fake.png", fakeExe, "image/png");
    expect(response.statusCode).toBe(415);
    await app.close();
  });
});
