import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

function readLockPid(path: string) {
  if (!existsSync(path)) return null;
  const pid = Number.parseInt(readFileSync(path, "utf8").trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

export function assertServerStopped(path: string) {
  const pid = readLockPid(path);
  if (pid && isProcessAlive(pid)) throw new Error(`Server masih berjalan (PID ${pid}). Hentikan server sebelum restore.`);
  if (existsSync(path)) rmSync(path, { force: true });
}

export function acquireRunLock(path: string) {
  assertServerStopped(path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, String(process.pid), { flag: "wx" });
  return () => {
    const pid = readLockPid(path);
    if (pid === process.pid) rmSync(path, { force: true });
  };
}
