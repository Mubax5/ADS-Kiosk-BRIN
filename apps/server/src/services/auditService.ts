import { randomUUID } from "node:crypto";
import type { SqliteDatabase } from "../db/database.js";

export type AuditInput = {
  userId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary?: Record<string, unknown>;
};

export function recordAudit(db: SqliteDatabase, input: AuditInput): void {
  db.prepare(`
    INSERT INTO audit_logs(id, user_id, action, target_type, target_id, summary_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.userId ?? null,
    input.action,
    input.targetType,
    input.targetId ?? null,
    JSON.stringify(input.summary ?? {}),
    new Date().toISOString(),
  );
}
