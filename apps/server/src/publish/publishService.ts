import { publishedManifestSchema, type PublishedManifest } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";
import { createPublishRepository } from "../db/repositories/publishRepository.js";
import { notFound } from "../services/errors.js";
import type { SettingsService } from "../services/settingsService.js";
import { buildManifest } from "./manifestBuilder.js";

export type PublishedVersionSummary = {
  version: number;
  publishedAt: string;
  publishedBy: string | null;
};

export function createPublishService(db: SqliteDatabase, settings: SettingsService) {
  const repository = createPublishRepository(db);

  function nextVersion(): number {
    const row = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM published_versions").get() as { version: number };
    return row.version;
  }

  const publishTx = db.transaction((userId: string) => {
    const version = nextVersion();
    const publishedAt = new Date().toISOString();
    const manifest = buildManifest(db, settings, version, publishedAt);
    repository.insert(manifest, userId);
    settings.markPublished(userId);
    return manifest;
  });

  const rollbackTx = db.transaction((sourceVersion: number, userId: string) => {
    const source = repository.get(sourceVersion);
    if (!source) throw notFound("Versi terbit tidak ditemukan");
    const manifest = publishedManifestSchema.parse({
      ...source,
      version: nextVersion(),
      publishedAt: new Date().toISOString(),
    });
    repository.insert(manifest, userId);
    return manifest;
  });

  return {
    publish(userId: string): PublishedManifest {
      return publishTx(userId);
    },
    rollback(sourceVersion: number, userId: string): PublishedManifest {
      return rollbackTx(sourceVersion, userId);
    },
    latest(): PublishedManifest | null {
      return repository.latest();
    },
    get(version: number): PublishedManifest | null {
      return repository.get(version);
    },
    list(): PublishedVersionSummary[] {
      return (db.prepare(`
        SELECT version, published_at, published_by
        FROM published_versions
        ORDER BY version DESC
      `).all() as { version: number; published_at: string; published_by: string | null }[]).map((row) => ({
        version: row.version,
        publishedAt: row.published_at,
        publishedBy: row.published_by,
      }));
    },
  };
}

export type PublishService = ReturnType<typeof createPublishService>;
