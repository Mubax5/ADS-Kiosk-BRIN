import type { SqliteDatabase } from "../database.js";

export type MediaCategory = "images" | "videos" | "pdf" | "documents";
export type MediaRecord = {
  id: string;
  originalName: string;
  storedName: string;
  category: MediaCategory;
  mimeType: string;
  byteSize: number;
  checksum: string;
  createdBy: string | null;
  createdAt: string;
};

type MediaRow = {
  id: string;
  original_name: string;
  stored_name: string;
  category: MediaCategory;
  mime_type: string;
  byte_size: number;
  checksum: string;
  created_by: string | null;
  created_at: string;
};

const fromRow = (row: MediaRow): MediaRecord => ({
  id: row.id,
  originalName: row.original_name,
  storedName: row.stored_name,
  category: row.category,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  checksum: row.checksum,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export function createMediaRepository(db: SqliteDatabase) {
  return {
    list(): MediaRecord[] {
      return (db.prepare("SELECT * FROM media ORDER BY created_at DESC").all() as MediaRow[]).map(fromRow);
    },
    get(id: string): MediaRecord | null {
      const row = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as MediaRow | undefined;
      return row ? fromRow(row) : null;
    },
    insert(record: MediaRecord): MediaRecord {
      db.prepare(`
        INSERT INTO media(id, original_name, stored_name, category, mime_type, byte_size, checksum, created_by, created_at)
        VALUES (@id, @originalName, @storedName, @category, @mimeType, @byteSize, @checksum, @createdBy, @createdAt)
      `).run(record);
      return this.get(record.id)!;
    },
    remove(id: string): void {
      db.prepare("DELETE FROM media WHERE id = ?").run(id);
    },
  };
}

export type MediaRepository = ReturnType<typeof createMediaRepository>;
