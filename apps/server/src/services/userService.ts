import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CmsRole } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";
import { hashPassword } from "../auth/password.js";
import { badRequest, conflict, notFound } from "./errors.js";

export type UserSummary = { id: string; username: string; role: CmsRole; canPublish: boolean; active: boolean; createdAt: string; updatedAt: string };
type UserRow = { id: string; username: string; role: CmsRole; can_publish: number; active: number; created_at: string; updated_at: string };
const fromRow = (row: UserRow): UserSummary => ({ id: row.id, username: row.username, role: row.role, canPublish: Boolean(row.can_publish), active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at });

const createSchema = z.object({ username: z.string().trim().min(3).max(120), password: z.string().min(8).max(1000), role: z.enum(["admin", "editor"]), canPublish: z.boolean().default(false) });
const updateSchema = z.object({ username: z.string().trim().min(3).max(120).optional(), password: z.string().min(8).max(1000).optional(), role: z.enum(["admin", "editor"]).optional(), canPublish: z.boolean().optional(), active: z.boolean().optional() });

export function createUserService(db: SqliteDatabase) {
  return {
    list(): UserSummary[] {
      return (db.prepare("SELECT id, username, role, can_publish, active, created_at, updated_at FROM users ORDER BY username").all() as UserRow[]).map(fromRow);
    },
    async create(input: unknown): Promise<UserSummary> {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw badRequest("Data pengguna tidak valid");
      const exists = db.prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE").get(parsed.data.username);
      if (exists) throw conflict("Username sudah digunakan");
      const id = randomUUID(); const now = new Date().toISOString();
      db.prepare(`INSERT INTO users(id,username,password_hash,role,can_publish,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`)
        .run(id, parsed.data.username, await hashPassword(parsed.data.password), parsed.data.role, parsed.data.canPublish ? 1 : 0, now, now);
      return fromRow(db.prepare("SELECT id, username, role, can_publish, active, created_at, updated_at FROM users WHERE id = ?").get(id) as UserRow);
    },
    async update(id: string, input: unknown): Promise<UserSummary> {
      const parsed = updateSchema.safeParse(input);
      if (!parsed.success) throw badRequest("Data pengguna tidak valid");
      const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as (UserRow & { password_hash: string }) | undefined;
      if (!existing) throw notFound("Pengguna tidak ditemukan");
      const username = parsed.data.username ?? existing.username;
      const duplicate = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?").get(username, id);
      if (duplicate) throw conflict("Username sudah digunakan");
      const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : existing.password_hash;
      const role = parsed.data.role ?? existing.role;
      const canPublish = parsed.data.canPublish ?? Boolean(existing.can_publish);
      const active = parsed.data.active ?? Boolean(existing.active);
      db.prepare(`UPDATE users SET username=?, password_hash=?, role=?, can_publish=?, active=?, updated_at=? WHERE id=?`)
        .run(username, passwordHash, role, canPublish ? 1 : 0, active ? 1 : 0, new Date().toISOString(), id);
      if (!active) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
      return fromRow(db.prepare("SELECT id, username, role, can_publish, active, created_at, updated_at FROM users WHERE id = ?").get(id) as UserRow);
    },
  };
}
