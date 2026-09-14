import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const token = randomBytes(32).toString("base64url");
const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
if (!adminUsername || !adminPassword) throw new Error("Playwright must provide E2E admin credentials");

const env = {
  ...process.env,
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  PORT: "4173",
  DATABASE_PATH: "./data/e2e/kiosk.db",
  STORAGE_PATH: "./storage-e2e",
  ADMIN_DIST_PATH: "./apps/admin/dist",
  KIOSK_DIST_PATH: "./apps/kiosk/dist",
  BACKUP_PATH: "./backups-e2e",
  LOG_PATH: "./logs-e2e",
  RUN_LOCK_PATH: "./data/e2e/server.lock",
  COOKIE_SECRET: randomBytes(32).toString("base64url"),
  COOKIE_SECURE: "false",
  SESSION_TTL_HOURS: "8",
  MAX_UPLOAD_BYTES: "10485760",
  KIOSK_DEVICE_ID: "kiosk-e2e",
  KIOSK_DEVICE_TOKEN: token,
  VITE_KIOSK_DEVICE_TOKEN: token,
  VITE_KIOSK_SOFTWARE_VERSION: "0.1.0-e2e",
  BOOTSTRAP_ADMIN_USERNAME: adminUsername,
  BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
};

for (const path of ["./data/e2e", "./storage-e2e", "./backups-e2e", "./logs-e2e"]) {
  rmSync(path, { recursive: true, force: true });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "build"]);
run("node", ["apps/server/dist/scripts/createAdmin.js"]);

const server = spawn("node", ["apps/server/dist/index.js"], {
  cwd: root,
  env,
  stdio: "inherit",
});

const shutdown = (signal) => {
  if (!server.killed) server.kill(signal);
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
server.once("exit", (code) => process.exit(code ?? 0));
