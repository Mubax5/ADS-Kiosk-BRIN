import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Writable } from "node:stream";
import pino from "pino";

function dayStamp(date: Date) {
  return date.toISOString().slice(0, 10);
}

class DailyLogStream extends Writable {
  private currentDay = "";

  constructor(private readonly directory: string, private readonly keepDays = 14) {
    super();
    mkdirSync(directory, { recursive: true });
  }

  private rotateIfNeeded(now: Date) {
    const nextDay = dayStamp(now);
    if (nextDay === this.currentDay) return;
    this.currentDay = nextDay;
    if (!existsSync(this.directory)) return;
    const logs = readdirSync(this.directory)
      .filter((name) => /^server-\d{4}-\d{2}-\d{2}\.log$/.test(name))
      .sort()
      .reverse();
    for (const stale of logs.slice(this.keepDays)) unlinkSync(join(this.directory, stale));
  }

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    try {
      const now = new Date();
      this.rotateIfNeeded(now);
      appendFileSync(join(this.directory, `server-${this.currentDay}.log`), chunk);
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error("Gagal menulis log server"));
    }
  }
}

export function createProductionLogger(logDirectory: string, level = "info") {
  return pino({ level }, new DailyLogStream(logDirectory));
}
