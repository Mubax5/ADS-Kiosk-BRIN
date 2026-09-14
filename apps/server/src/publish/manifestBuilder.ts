import { adItemSchema, publishedManifestSchema, type AdItem, type PublishedManifest } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";
import { createMediaRepository } from "../db/repositories/mediaRepository.js";
import { createMenuRepository } from "../db/repositories/menuRepository.js";
import type { SettingsService } from "../services/settingsService.js";

type AdRow = {
  id: string;
  media_id: string;
  media_type: "image" | "video";
  active: number;
  sort_order: number;
  display_duration_seconds: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

function mapAd(row: AdRow): AdItem {
  return adItemSchema.parse({
    id: row.id,
    mediaId: row.media_id,
    mediaType: row.media_type,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    displayDurationSeconds: row.display_duration_seconds,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  });
}

export function buildManifest(
  db: SqliteDatabase,
  settings: SettingsService,
  version: number,
  publishedAt: string,
): PublishedManifest {
  const menus = createMenuRepository(db).list().filter((item) => item.active);
  const ads = (db.prepare("SELECT * FROM ads WHERE active = 1 ORDER BY sort_order, id").all() as AdRow[]).map(mapAd);
  const mediaRepository = createMediaRepository(db);

  const mediaIds = new Set<string>();
  for (const item of menus) {
    if (item.mediaId) mediaIds.add(item.mediaId);
  }
  for (const ad of ads) mediaIds.add(ad.mediaId);

  const media = [...mediaIds].map((id) => {
    const record = mediaRepository.get(id);
    if (!record) throw new Error(`Referenced media is missing: ${id}`);
    return {
      id: record.id,
      url: `/media/${record.id}`,
      mimeType: record.mimeType,
      byteSize: record.byteSize,
      checksum: record.checksum,
    };
  });

  return publishedManifestSchema.parse({
    version,
    publishedAt,
    menuItems: menus,
    ads,
    settings: settings.getKioskSettings(),
    media,
  });
}
