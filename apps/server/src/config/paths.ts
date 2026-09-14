import { isAbsolute, resolve } from "node:path";

export type RuntimePathInput = {
  databasePath: string;
  storagePath: string;
  adminDistPath: string;
  kioskDistPath: string;
  backupPath: string;
  logPath: string;
  runLockPath: string;
};

function absolute(cwd: string, value: string) {
  return isAbsolute(value) ? value : resolve(cwd, value);
}

export function resolveRuntimePaths(input: RuntimePathInput, cwd = process.cwd()) {
  return {
    databasePath: absolute(cwd, input.databasePath),
    storagePath: absolute(cwd, input.storagePath),
    adminDistPath: absolute(cwd, input.adminDistPath),
    kioskDistPath: absolute(cwd, input.kioskDistPath),
    backupPath: absolute(cwd, input.backupPath),
    logPath: absolute(cwd, input.logPath),
    runLockPath: absolute(cwd, input.runLockPath),
  };
}
