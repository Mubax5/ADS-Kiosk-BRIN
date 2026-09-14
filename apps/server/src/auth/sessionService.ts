import { randomBytes } from "node:crypto";
import type { CmsUser } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";

export type CmsSession = {
  id: string;
  csrfToken: string;
  expiresAt: string;
  user: CmsUser;
};

type SessionRow = {
  id: string;
  csrf_token: string;
  expires_at: string;
  user_id: string;
  username: string;
  role: "admin" | "editor";
  can_publish: number;
  active: number;
};

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function createSession(db: SqliteDatabase, userId: string, ttlHours: number): CmsSession {
  const user = db.prepare(`
    SELECT id, username, role, can_publish, active
    FROM users WHERE id = ?
  `).get(userId) as Omit<SessionRow, "csrf_token" | "expires_at" | "user_id"> | undefined;
  if (!user || !user.active) throw new Error("Cannot create session for inactive user");

  const id = randomToken();
  const csrfToken = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions(id, user_id, csrf_token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, csrfToken, expiresAt, now.toISOString());

  return {
    id,
    csrfToken,
    expiresAt,
    user: { id: user.id, username: user.username, role: user.role, canPublish: Boolean(user.can_publish) },
  };
}

export function getSession(db: SqliteDatabase, id: string): CmsSession | null {
  const row = db.prepare(`
    SELECT s.id, s.csrf_token, s.expires_at, u.id AS user_id, u.username, u.role, u.can_publish, u.active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(id) as SessionRow | undefined;

  if (!row || !row.active) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }

  return {
    id: row.id,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      username: row.username,
      role: row.role,
      canPublish: Boolean(row.can_publish),
    },
  };
}

export function deleteSession(db: SqliteDatabase, id: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export function deleteExpiredSessions(db: SqliteDatabase): number {
  return db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString()).changes;
}
