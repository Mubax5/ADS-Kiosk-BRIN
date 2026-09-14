import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { env } from "../config/env.js";
import { resolveRuntimePaths } from "../config/paths.js";
import { assertServerStopped } from "../config/runLock.js";

const backupArgument = process.argv[2];
if (!backupArgument) throw new Error("Usage: npm run restore --workspace @ads-kiosk/server -- <backup-directory>");

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

const backupDirectory = resolve(backupArgument);
const databaseSource = join(backupDirectory, "kiosk.db");
const storageSource = join(backupDirectory, "storage");
if (!existsSync(databaseSource) || !existsSync(storageSource)) {
  throw new Error("Backup tidak valid: kiosk.db dan storage/ wajib tersedia dalam direktori yang sama.");
}

mkdirSync(dirname(paths.databasePath), { recursive: true });
mkdirSync(dirname(paths.storagePath), { recursive: true });
const databaseTemp = `${paths.databasePath}.restore-new`;
const storageTemp = `${paths.storagePath}.restore-new`;
rmSync(databaseTemp, { force: true });
rmSync(storageTemp, { recursive: true, force: true });
cpSync(databaseSource, databaseTemp);
cpSync(storageSource, storageTemp, { recursive: true });
rmSync(paths.databasePath, { force: true });
rmSync(paths.storagePath, { recursive: true, force: true });
cpSync(databaseTemp, paths.databasePath);
cpSync(storageTemp, paths.storagePath, { recursive: true });
rmSync(databaseTemp, { force: true });
rmSync(storageTemp, { recursive: true, force: true });
console.log(`Restore selesai dari ${backupDirectory}`);
