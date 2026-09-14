import { readFileSync } from "node:fs";
import type { SqliteDatabase } from "./database.js";

const MIGRATIONS = [
  { version: 1, path: new URL("../../migrations/001_initial.sql", import.meta.url) },
] as const;

export function migrate(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = db.prepare("SELECT version FROM schema_migrations").all()
    .map((row) => (row as { version: number }).version);
  const appliedSet = new Set(applied);
  const insertMigration = db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)");

  const apply = db.transaction((version: number, sql: string) => {
    db.exec(sql);
    insertMigration.run(version, new Date().toISOString());
  });

  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.version)) {
      apply(migration.version, readFileSync(migration.path, "utf8"));
    }
  }
}
