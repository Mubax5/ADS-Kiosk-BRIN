import { adItemSchema, type AdItem } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";
import { createMediaRepository } from "../db/repositories/mediaRepository.js";
import { badRequest, notFound } from "./errors.js";
import type { SettingsService } from "./settingsService.js";

type AdRow = {
  id: string; media_id: string; media_type: "image" | "video"; active: number; sort_order: number;
  display_duration_seconds: number | null; starts_at: string | null; ends_at: string | null;
};

const fromRow = (row: AdRow): AdItem => adItemSchema.parse({
  id: row.id, mediaId: row.media_id, mediaType: row.media_type, active: Boolean(row.active), sortOrder: row.sort_order,
  displayDurationSeconds: row.display_duration_seconds, startsAt: row.starts_at, endsAt: row.ends_at,
});

export function createAdService(db: SqliteDatabase, settings: SettingsService) {
  const media = createMediaRepository(db);
  return {
    list(): AdItem[] {
      return (db.prepare("SELECT * FROM ads ORDER BY sort_order, id").all() as AdRow[]).map(fromRow);
    },
    save(input: unknown, userId: string): AdItem {
      const parsed = adItemSchema.safeParse(input);
      if (!parsed.success) throw badRequest("Konfigurasi iklan tidak valid");
      const item = parsed.data;
      const record = media.get(item.mediaId);
      if (!record) throw badRequest("Media iklan tidak ditemukan");
      const expectedCategory = item.mediaType === "image" ? "images" : "videos";
      if (record.category !== expectedCategory) throw badRequest("Jenis media iklan tidak sesuai");
      if (item.mediaType === "image" && item.displayDurationSeconds === null) throw badRequest("Durasi gambar wajib diisi");

      db.prepare(`
        INSERT INTO ads(id, media_id, media_type, active, sort_order, display_duration_seconds, starts_at, ends_at, updated_by, updated_at)
        VALUES (@id,@mediaId,@mediaType,@active,@sortOrder,@duration,@startsAt,@endsAt,@updatedBy,@updatedAt)
        ON CONFLICT(id) DO UPDATE SET media_id=excluded.media_id, media_type=excluded.media_type, active=excluded.active,
          sort_order=excluded.sort_order, display_duration_seconds=excluded.display_duration_seconds, starts_at=excluded.starts_at,
          ends_at=excluded.ends_at, updated_by=excluded.updated_by, updated_at=excluded.updated_at
      `).run({ id: item.id, mediaId: item.mediaId, mediaType: item.mediaType, active: item.active ? 1 : 0, sortOrder: item.sortOrder,
        duration: item.displayDurationSeconds, startsAt: item.startsAt, endsAt: item.endsAt, updatedBy: userId, updatedAt: new Date().toISOString() });
      settings.incrementDraftRevision(userId);
      return fromRow(db.prepare("SELECT * FROM ads WHERE id = ?").get(item.id) as AdRow);
    },
    remove(id: string, userId: string): void {
      const result = db.prepare("DELETE FROM ads WHERE id = ?").run(id);
      if (!result.changes) throw notFound("Iklan tidak ditemukan");
      settings.incrementDraftRevision(userId);
    },
  };
}
