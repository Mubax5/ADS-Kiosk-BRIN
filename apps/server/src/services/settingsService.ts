import { kioskSettingsSchema, type KioskSettings } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";
import { badRequest } from "./errors.js";

export function createSettingsService(db: SqliteDatabase) {
  function getValue<T>(key: string, fallback: T): T {
    const row = db.prepare("SELECT value_json FROM settings WHERE key = ?").get(key) as { value_json: string } | undefined;
    if (!row) return fallback;
    try { return JSON.parse(row.value_json) as T; } catch { return fallback; }
  }

  function setValue(key: string, value: unknown, updatedBy: string | null): void {
    db.prepare(`
      INSERT INTO settings(key, value_json, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_by=excluded.updated_by, updated_at=excluded.updated_at
    `).run(key, JSON.stringify(value), updatedBy, new Date().toISOString());
  }

  const incrementRevisionTx = db.transaction((updatedBy: string | null) => {
    const next = getValue<number>("draftRevision", 0) + 1;
    setValue("draftRevision", next, updatedBy);
    return next;
  });

  function getKioskSettings(): KioskSettings {
    return kioskSettingsSchema.parse({
      sessionTimeoutSeconds: getValue("sessionTimeoutSeconds", 60),
      sessionWarningSeconds: getValue("sessionWarningSeconds", 10),
      deviceDisplayName: getValue("deviceDisplayName", "Kiosk Utama"),
    });
  }

  return {
    getValue,
    setValue,
    getKioskSettings,
    updateKioskSettings(input: unknown, updatedBy: string): KioskSettings {
      const current = getKioskSettings();
      const parsed = kioskSettingsSchema.safeParse({ ...current, ...(typeof input === "object" && input ? input : {}) });
      if (!parsed.success) throw badRequest("Pengaturan kiosk tidak valid");
      setValue("sessionTimeoutSeconds", parsed.data.sessionTimeoutSeconds, updatedBy);
      setValue("sessionWarningSeconds", parsed.data.sessionWarningSeconds, updatedBy);
      setValue("deviceDisplayName", parsed.data.deviceDisplayName, updatedBy);
      incrementRevisionTx(updatedBy);
      return parsed.data;
    },
    incrementDraftRevision(updatedBy: string | null): number {
      return incrementRevisionTx(updatedBy);
    },
    getRevisions() {
      return {
        draftRevision: getValue<number>("draftRevision", 0),
        publishedRevision: getValue<number>("publishedRevision", 0),
      };
    },
    markPublished(updatedBy: string | null): void {
      setValue("publishedRevision", getValue<number>("draftRevision", 0), updatedBy);
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
