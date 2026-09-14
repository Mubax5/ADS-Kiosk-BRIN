import { publishedManifestSchema, type PublishedManifest } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../database.js";

type PublishRow = { manifest_json: string };

function parse(row: PublishRow | undefined): PublishedManifest | null {
  return row ? publishedManifestSchema.parse(JSON.parse(row.manifest_json)) : null;
}

export function createPublishRepository(db: SqliteDatabase) {
  return {
    latest(): PublishedManifest | null {
      return parse(db.prepare("SELECT manifest_json FROM published_versions ORDER BY version DESC LIMIT 1").get() as PublishRow | undefined);
    },
    get(version: number): PublishedManifest | null {
      return parse(db.prepare("SELECT manifest_json FROM published_versions WHERE version = ?").get(version) as PublishRow | undefined);
    },
    insert(manifest: PublishedManifest, publishedBy: string): void {
      const value = publishedManifestSchema.parse(manifest);
      db.prepare(`
        INSERT INTO published_versions(version, manifest_json, published_by, published_at)
        VALUES (?, ?, ?, ?)
      `).run(value.version, JSON.stringify(value), publishedBy, value.publishedAt);
    },
  };
}

export type PublishRepository = ReturnType<typeof createPublishRepository>;
