import type { SqliteDatabase } from "../db/database.js";
import type { SettingsService } from "./settingsService.js";

export function createDashboardService(db: SqliteDatabase, settings: SettingsService) {
  return {
    get() {
      const kiosk = db.prepare("SELECT * FROM kiosk_devices ORDER BY id LIMIT 1").get() as {
        id: string; name: string; last_seen_at: string | null; current_version: number | null; last_sync_at: string | null; last_sync_status: string | null;
      } | undefined;
      const latest = db.prepare("SELECT MAX(version) AS version FROM published_versions").get() as { version: number | null };
      const menu = db.prepare("SELECT COUNT(*) AS count FROM menu_items WHERE active = 1").get() as { count: number };
      const ads = db.prepare("SELECT COUNT(*) AS count FROM ads WHERE active = 1").get() as { count: number };
      const storage = db.prepare("SELECT COALESCE(SUM(byte_size), 0) AS bytes FROM media").get() as { bytes: number };
      const revisions = settings.getRevisions();
      const online = Boolean(kiosk?.last_seen_at && Date.now() - Date.parse(kiosk.last_seen_at) <= 90_000);
      return {
        kiosk: kiosk ? { id: kiosk.id, name: kiosk.name, online, lastSeen: kiosk.last_seen_at, activeVersion: kiosk.current_version, lastSyncStatus: kiosk.last_sync_status } : null,
        publishedVersion: latest.version,
        lastSync: kiosk?.last_sync_at ?? null,
        hasUnpublishedChanges: revisions.draftRevision !== revisions.publishedRevision,
        menuCount: menu.count,
        activeAdCount: ads.count,
        mediaBytes: storage.bytes,
      };
    },
  };
}
