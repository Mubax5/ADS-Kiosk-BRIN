import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth/guards.js";
import { buildManifest } from "../publish/manifestBuilder.js";
import type { SettingsService } from "../services/settingsService.js";

export async function registerAdminPreviewRoute(app: FastifyInstance, settings: SettingsService) {
  app.get("/api/v1/admin/preview-manifest", { preHandler: requireUser }, async () => {
    const row = app.db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM published_versions").get() as { version: number };
    return buildManifest(app.db, settings, Math.max(1, row.version + 1), new Date().toISOString());
  });
}
