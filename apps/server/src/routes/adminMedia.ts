import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth/guards.js";
import type { MediaService } from "../media/mediaService.js";
import { recordAudit } from "../services/auditService.js";

export async function registerAdminMediaRoutes(app: FastifyInstance, mediaService: MediaService): Promise<void> {
  app.get("/api/v1/admin/media", { preHandler: requireUser }, async () => ({ items: mediaService.list() }));

  app.post("/api/v1/admin/media", { preHandler: requireUser }, async (request, reply) => {
    const part = await request.file();
    if (!part) return reply.code(400).send({ error: "FILE_REQUIRED", message: "Pilih file untuk diunggah" });
    const record = await mediaService.store(part.file, part.filename, request.cmsUser!.id);
    recordAudit(app.db, {
      userId: request.cmsUser!.id,
      action: "media.upload",
      targetType: "media",
      targetId: record.id,
      summary: { originalName: record.originalName, byteSize: record.byteSize, mimeType: record.mimeType },
    });
    return reply.code(201).send(record);
  });

  app.delete<{ Params: { id: string } }>("/api/v1/admin/media/:id", { preHandler: requireUser }, async (request, reply) => {
    await mediaService.remove(request.params.id);
    recordAudit(app.db, {
      userId: request.cmsUser!.id,
      action: "media.delete",
      targetType: "media",
      targetId: request.params.id,
    });
    return reply.code(204).send();
  });
}
