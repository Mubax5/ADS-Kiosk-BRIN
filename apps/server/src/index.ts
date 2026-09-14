import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { openDatabase } from "./db/database.js";
import { migrate } from "./db/migrate.js";
import { seedInitialContent } from "./db/seed.js";

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
mkdirSync(env.STORAGE_PATH, { recursive: true });
const db = openDatabase(env.DATABASE_PATH);
migrate(db);
seedInitialContent(db);

const app = await buildApp({
  db,
  cookieSecret: env.COOKIE_SECRET,
  cookieSecure: env.COOKIE_SECURE,
  sessionTtlHours: env.SESSION_TTL_HOURS,
  logger: true,
});

const close = async () => {
  await app.close();
  db.close();
};
process.once("SIGINT", () => void close().finally(() => process.exit(0)));
process.once("SIGTERM", () => void close().finally(() => process.exit(0)));

await app.listen({ host: env.HOST, port: env.PORT });
