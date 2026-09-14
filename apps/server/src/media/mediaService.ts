import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { PublishedManifest } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../db/database.js";
import { createMediaRepository, type MediaRecord } from "../db/repositories/mediaRepository.js";
import { MediaValidationError, validateMediaFile } from "./mediaValidation.js";

export class MediaConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "MediaConflictError";
  }
}

export class MediaNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = "Media tidak ditemukan") {
    super(message);
    this.name = "MediaNotFoundError";
  }
}

type MultipartReadable = Readable & { truncated?: boolean };

export function createMediaService(db: SqliteDatabase, storagePath: string, maxUploadBytes: number) {
  const repository = createMediaRepository(db);
  const root = resolve(storagePath);
  const incoming = join(root, ".incoming");

  async function ensureDirectories() {
    await Promise.all([incoming, "images", "videos", "pdf", "documents"].map((directory) =>
      mkdir(directory === incoming ? incoming : join(root, directory), { recursive: true }),
    ));
  }

  function filePath(record: MediaRecord): string {
    return join(root, record.category, record.storedName);
  }

  function isPublishedReference(id: string): boolean {
    const rows = db.prepare("SELECT manifest_json FROM published_versions").all() as { manifest_json: string }[];
    return rows.some((row) => {
      try {
        const manifest = JSON.parse(row.manifest_json) as PublishedManifest;
        return manifest.media.some((media) => media.id === id);
      } catch {
        return true;
      }
    });
  }

  return {
    list(): MediaRecord[] {
      return repository.list();
    },

    get(id: string): MediaRecord | null {
      return repository.get(id);
    },

    filePath,

    async store(stream: MultipartReadable, originalName: string, createdBy: string | null): Promise<MediaRecord> {
      await ensureDirectories();
      const tempPath = join(incoming, `${randomUUID()}.upload`);
      const hash = createHash("sha256");
      let movedPath: string | null = null;

      const hashingStream = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          hash.update(chunk);
          callback(null, chunk);
        },
      });

      try {
        await pipeline(stream, hashingStream, createWriteStream(tempPath, { flags: "wx" }));
        const info = await stat(tempPath);
        if (stream.truncated || info.size > maxUploadBytes) {
          const error = new Error("Ukuran file melebihi batas upload") as Error & { statusCode: number };
          error.statusCode = 413;
          throw error;
        }

        const validated = await validateMediaFile(tempPath, originalName);
        const id = randomUUID();
        const storedName = `${id}${validated.storedExtension}`;
        const destination = join(root, validated.category, storedName);
        await rename(tempPath, destination);
        movedPath = destination;

        const record: MediaRecord = {
          id,
          originalName,
          storedName,
          category: validated.category,
          mimeType: validated.mimeType,
          byteSize: info.size,
          checksum: hash.digest("hex"),
          createdBy,
          createdAt: new Date().toISOString(),
        };
        return repository.insert(record);
      } catch (error) {
        if (movedPath) await unlink(movedPath).catch(() => undefined);
        else await unlink(tempPath).catch(() => undefined);
        throw error;
      }
    },

    async remove(id: string): Promise<void> {
      const record = repository.get(id);
      if (!record) throw new MediaNotFoundError();

      const draftReferenced = Boolean(
        db.prepare("SELECT 1 FROM menu_items WHERE media_id = ? LIMIT 1").get(id)
        || db.prepare("SELECT 1 FROM ads WHERE media_id = ? LIMIT 1").get(id),
      );
      if (draftReferenced || isPublishedReference(id)) {
        throw new MediaConflictError("Media masih digunakan oleh konten draft atau versi terbit");
      }

      const source = filePath(record);
      const trash = `${source}.delete-${randomUUID()}`;
      await rename(source, trash).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") throw new MediaNotFoundError("File media tidak ditemukan di penyimpanan");
        throw error;
      });
      try {
        repository.remove(id);
        await unlink(trash);
      } catch (error) {
        await rename(trash, source).catch(() => undefined);
        throw error;
      }
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
export { MediaValidationError };
