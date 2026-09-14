import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDatabase } from "../db/database.js";

export type BackupServiceOptions = {
  db: SqliteDatabase;
  storagePath: string;
  backupRoot: string;
  configTemplatePath?: string;
  now?: () => Date;
};

function backupId(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

export function createBackupService(options: BackupServiceOptions) {
  return {
    async createBackup() {
      const id = backupId((options.now ?? (() => new Date()))());
      const path = join(options.backupRoot, id);
      if (existsSync(path)) throw new Error(`Backup already exists: ${id}`);
      mkdirSync(path, { recursive: true });

      const databaseDestination = join(path, "kiosk.db");
      await options.db.backup(databaseDestination);
      if (existsSync(options.storagePath)) cpSync(options.storagePath, join(path, "storage"), { recursive: true });
      else mkdirSync(join(path, "storage"), { recursive: true });

      if (options.configTemplatePath && existsSync(options.configTemplatePath)) {
        cpSync(options.configTemplatePath, join(path, "deployment-config.example"));
      }

      return { id, path };
    },
  };
}
