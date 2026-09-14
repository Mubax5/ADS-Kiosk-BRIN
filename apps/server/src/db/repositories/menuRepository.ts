import { menuItemSchema, type MenuItem } from "@ads-kiosk/shared";
import type { SqliteDatabase } from "../database.js";

type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  content_type: MenuItem["contentType"];
  content_config_json: string;
  media_id: string | null;
  active: number;
  sort_order: number;
};

function fromRow(row: MenuRow): MenuItem {
  return menuItemSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    contentType: row.content_type,
    content: JSON.parse(row.content_config_json),
    mediaId: row.media_id,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
  });
}

export function createMenuRepository(db: SqliteDatabase) {
  return {
    list(): MenuItem[] {
      return (db.prepare("SELECT * FROM menu_items ORDER BY sort_order, name").all() as MenuRow[]).map(fromRow);
    },
    get(id: string): MenuItem | null {
      const row = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id) as MenuRow | undefined;
      return row ? fromRow(row) : null;
    },
    upsert(input: MenuItem, updatedBy: string | null = null): MenuItem {
      const item = menuItemSchema.parse(input);
      db.prepare(`
        INSERT INTO menu_items(id, name, description, content_type, content_config_json, media_id, active, sort_order, updated_by, updated_at)
        VALUES (@id, @name, @description, @contentType, @contentJson, @mediaId, @active, @sortOrder, @updatedBy, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          description=excluded.description,
          content_type=excluded.content_type,
          content_config_json=excluded.content_config_json,
          media_id=excluded.media_id,
          active=excluded.active,
          sort_order=excluded.sort_order,
          updated_by=excluded.updated_by,
          updated_at=excluded.updated_at
      `).run({
        id: item.id,
        name: item.name,
        description: item.description,
        contentType: item.contentType,
        contentJson: JSON.stringify(item.content),
        mediaId: item.mediaId,
        active: item.active ? 1 : 0,
        sortOrder: item.sortOrder,
        updatedBy,
        updatedAt: new Date().toISOString(),
      });
      return this.get(item.id)!;
    },
    remove(id: string): void {
      db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
    },
  };
}

export type MenuRepository = ReturnType<typeof createMenuRepository>;
