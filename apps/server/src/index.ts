import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { createProductionLogger } from "./config/logger.js";
import { resolveRuntimePaths } from "./config/paths.js";
import { acquireRunLock } from "./config/runLock.js";
import { openDatabase } from "./db/database.js";
import { migrate } from "./db/migrate.js";
import { seedInitialContent } from "./db/seed.js";

const paths = resolveRuntimePaths({
  databasePath: env.DATABASE_PATH,
  storagePath: env.STORAGE_PATH,
  adminDistPath: env.ADMIN_DIST_PATH,
  kioskDistPath: env.KIOSK_DIST_PATH,
  backupPath: env.BACKUP_PATH,
  logPath: env.LOG_PATH,
  runLockPath: env.RUN_LOCK_PATH,
});

mkdirSync(dirname(paths.databasePath), { recursive: true });
mkdirSync(paths.storagePath, { recursive: true });
mkdirSync(paths.backupPath, { recursive: true });
mkdirSync(paths.logPath, { recursive: true });
const releaseRunLock = acquireRunLock(paths.runLockPath);

const db = openDatabase(paths.databasePath);
migrate(db);
seedInitialContent(db);

const baseOptions = {
  db,
  cookieSecret: env.COOKIE_SECRET,
  cookieSecure: env.COOKIE_SECURE,
  sessionTtlHours: env.SESSION_TTL_HOURS,
  storagePath: paths.storagePath,
  maxUploadBytes: env.MAX_UPLOAD_BYTES,
  kioskDeviceId: env.KIOSK_DEVICE_ID,
  kioskDeviceToken: env.KIOSK_DEVICE_TOKEN,
  adminDistPath: paths.adminDistPath,
  kioskDistPath: paths.kioskDistPath,
};
const app = await buildApp(env.NODE_ENV === "production"
  ? { ...baseOptions, loggerInstance: createProductionLogger(paths.logPath, env.LOG_LEVEL) }
  : { ...baseOptions, logger: true });

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  try {
    await app.close();
    db.close();
  } finally {
    releaseRunLock();
  }
};
process.once("SIGINT", () => void close().finally(() => process.exit(0)));
process.once("SIGTERM", () => void close().finally(() => process.exit(0)));
process.once("uncaughtException", (error) => {
  app.log.fatal(error);
  void close().finally(() => process.exit(1));
});
process.once("unhandledRejection", (error) => {
  app.log.fatal({ error }, "Unhandled rejection");
  void close().finally(() => process.exit(1));
});

await app.listen({ host: env.HOST, port: env.PORT });
