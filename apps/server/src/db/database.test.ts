import { describe, expect, it } from "vitest";
import { openDatabase } from "./database.js";
import { migrate } from "./migrate.js";
import { seedInitialContent } from "./seed.js";

describe("database migrations and seed", () => {
  it("creates all required tables and seeds the 15 initial menu labels", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    seedInitialContent(db);

    const names = db.prepare("select name from menu_items order by sort_order").all().map((row) => (row as { name: string }).name);
    expect(names).toEqual([
      "RADMON", "ELSA", "ELIRA", "HIRADC", "PENGADUAN", "RAPAT", "WAC PADAT", "WAC ZRTTD",
      "WAC CAIR", "WAC BBNB", "WEB BRIN", "WAC SEMI CAIR", "IKM KUNJUNGAN", "IKM PKL/KP/TA", "BUKU TAMU",
    ]);

    const tables = db.prepare("select name from sqlite_master where type = 'table'").all().map((row) => (row as { name: string }).name);
    for (const table of ["users", "sessions", "menu_items", "ads", "media", "settings", "published_versions", "audit_logs", "kiosk_devices"]) {
      expect(tables).toContain(table);
    }
  });
});
