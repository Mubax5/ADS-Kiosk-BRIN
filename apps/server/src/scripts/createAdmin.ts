import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { hashPassword } from "../auth/password.js";
import { env } from "../config/env.js";
import { openDatabase } from "../db/database.js";
import { migrate } from "../db/migrate.js";

const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!username || !password || password.length < 8) {
  throw new Error("BOOTSTRAP_ADMIN_USERNAME and a BOOTSTRAP_ADMIN_PASSWORD of at least 8 characters are required");
}

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
const db = openDatabase(env.DATABASE_PATH);
migrate(db);
const now = new Date().toISOString();
const passwordHash = await hashPassword(password);
const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username) as { id: string } | undefined;
const id = existing?.id ?? randomUUID();

db.prepare(`
  INSERT INTO users(id, username, password_hash, role, can_publish, active, created_at, updated_at)
  VALUES (?, ?, ?, 'admin', 1, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    username=excluded.username,
    password_hash=excluded.password_hash,
    role='admin',
    can_publish=1,
    active=1,
    updated_at=excluded.updated_at
`).run(id, username, passwordHash, now, now);

db.close();
console.log(`Admin ready: ${username}`);
