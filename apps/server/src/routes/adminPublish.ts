import type { FastifyInstance } from "fastify";
import { requirePublisher, requireUser } from "../auth/guards.js";
import type { PublishService } from "../publish/publishService.js";
import { recordAudit } from "../services/auditService.js";
import { badRequest } from "../services/errors.js";

export async function registerAdminPublishRoutes(app: FastifyInstance, service: PublishService): Promise<void> {
  app.get("/api/v1/admin/versions", { preHandler: requireUser }, async () => ({ items: service.list() }));

  app.post("/api/v1/admin/publish", { preHandler: requirePublisher }, async (request, reply) => {
    const manifest = service.publish(request.cmsUser!.id);
    recordAudit(app.db, {
      userId: request.cmsUser!.id,
      action: "publish.create",
      targetType: "published_version",
      targetId: String(manifest.version),
      summary: { version: manifest.version },
    });
    return reply.code(201).send(manifest);
  });

  app.post<{ Params: { version: string } }>("/api/v1/admin/versions/:version/rollback", { preHandler: requirePublisher }, async (request, reply) => {
    const sourceVersion = Number(request.params.version);
    if (!Number.isInteger(sourceVersion) || sourceVersion <= 0) throw badRequest("Versi rollback tidak valid");
    const manifest = service.rollback(sourceVersion, request.cmsUser!.id);
    recordAudit(app.db, {
      userId: request.cmsUser!.id,
      action: "publish.rollback",
      targetType: "published_version",
      targetId: String(manifest.version),
      summary: { sourceVersion, newVersion: manifest.version },
    });
    return reply.code(201).send(manifest);
  });
}
