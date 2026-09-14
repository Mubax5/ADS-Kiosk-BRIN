import { randomUUID } from "node:crypto";
import type { SqliteDatabase } from "./database.js";

const INITIAL_MENU_NAMES = [
  "RADMON", "ELSA", "ELIRA", "HIRADC", "PENGADUAN", "RAPAT", "WAC PADAT", "WAC ZRTTD",
  "WAC CAIR", "WAC BBNB", "WEB BRIN", "WAC SEMI CAIR", "IKM KUNJUNGAN", "IKM PKL/KP/TA", "BUKU TAMU",
] as const;

function setSettingIfMissing(db: SqliteDatabase, key: string, value: unknown): void {
  db.prepare(`
    INSERT INTO settings(key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `).run(key, JSON.stringify(value), new Date().toISOString());
}

export function seedInitialContent(db: SqliteDatabase): void {
  const menuCount = (db.prepare("SELECT COUNT(*) AS count FROM menu_items").get() as { count: number }).count;
  if (menuCount === 0) {
    const insert = db.prepare(`
      INSERT INTO menu_items(
        id, name, description, content_type, content_config_json, media_id, active, sort_order, updated_at
      ) VALUES (?, ?, NULL, 'text', ?, NULL, 1, ?, ?)
    `);
    const seedMenu = db.transaction(() => {
      INITIAL_MENU_NAMES.forEach((name, index) => {
        insert.run(
          randomUUID(),
          name,
          JSON.stringify({ type: "text", title: name, body: "Konten belum tersedia." }),
          index + 1,
          new Date().toISOString(),
        );
      });
    });
    seedMenu();
  }

  setSettingIfMissing(db, "sessionTimeoutSeconds", 60);
  setSettingIfMissing(db, "sessionWarningSeconds", 10);
  setSettingIfMissing(db, "deviceDisplayName", "Kiosk Utama");
  setSettingIfMissing(db, "draftRevision", 0);
  setSettingIfMissing(db, "publishedRevision", 0);
}
