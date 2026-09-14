import { resolve } from "node:path";
import { env } from "../config/env.js";
import { resolveRuntimePaths } from "../config/paths.js";
import { assertServerStopped } from "../config/runLock.js";
import { openDatabase } from "../db/database.js";
import { createBackupService } from "../services/backupService.js";

const paths = resolveRuntimePaths({
  databasePath: env.DATABASE_PATH,
  storagePath: env.STORAGE_PATH,
  adminDistPath: env.ADMIN_DIST_PATH,
  kioskDistPath: env.KIOSK_DIST_PATH,
  backupPath: env.BACKUP_PATH,
  logPath: env.LOG_PATH,
  runLockPath: env.RUN_LOCK_PATH,
});

assertServerStopped(paths.runLockPath);
const db = openDatabase(paths.databasePath);
try {
  const service = createBackupService({
    db,
    storagePath: paths.storagePath,
    backupRoot: paths.backupPath,
    configTemplatePath: resolve(process.cwd(), ".env.example"),
  });
  const result = await service.createBackup();
  console.log(`Backup selesai: ${result.path}`);
} finally {
  db.close();
}
