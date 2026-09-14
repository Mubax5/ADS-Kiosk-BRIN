import { menuItemSchema, type MenuItem } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";
import { createMediaRepository } from "../db/repositories/mediaRepository.js";
import { createMenuRepository } from "../db/repositories/menuRepository.js";
import type { SettingsService } from "./settingsService.js";
import { badRequest, notFound } from "./errors.js";

export function createMenuService(db: SqliteDatabase, settings: SettingsService) {
  const menus = createMenuRepository(db);
  const media = createMediaRepository(db);

  function normalize(input: unknown): MenuItem {
    const parsed = menuItemSchema.safeParse(input);
    if (!parsed.success) throw badRequest("Konfigurasi menu tidak valid");
    const item = parsed.data;
    const contentMediaId = "mediaId" in item.content ? item.content.mediaId : null;
    const normalized = { ...item, mediaId: contentMediaId };

    if (contentMediaId) {
      const record = media.get(contentMediaId);
      if (!record) throw badRequest("Media yang dipilih tidak ditemukan");
      const expected = item.content.type === "pdf" ? "pdf" : item.content.type === "image" ? "images" : item.content.type === "video" ? "videos" : null;
      if (expected && record.category !== expected) throw badRequest("Jenis media tidak sesuai dengan jenis konten");
    }
    return normalized;
  }

  return {
    list: () => menus.list(),
    get: (id: string) => menus.get(id),
    save(input: unknown, userId: string): MenuItem {
      const item = normalize(input);
      const result = menus.upsert(item, userId);
      settings.incrementDraftRevision(userId);
      return result;
    },
    remove(id: string, userId: string): void {
      if (!menus.get(id)) throw notFound("Menu tidak ditemukan");
      menus.remove(id);
      settings.incrementDraftRevision(userId);
    },
  };
}
