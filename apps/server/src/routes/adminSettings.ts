import type { FastifyInstance } from "fastify";
import { requireAdmin, requireUser } from "../auth/guards.js";
import type { ReturnTypeSettingsService } from "../types/internal.js";
import { recordAudit } from "../services/auditService.js";

export async function registerAdminSettingsRoutes(app: FastifyInstance, service: ReturnTypeSettingsService): Promise<void> {
  app.get("/api/v1/admin/settings", { preHandler: requireUser }, async () => service.getKioskSettings());
  app.put("/api/v1/admin/settings", { preHandler: requireAdmin }, async (request, reply) => {
    const value = service.updateKioskSettings(request.body, request.cmsUser!.id);
    recordAudit(app.db, { userId: request.cmsUser!.id, action: "settings.edit", targetType: "settings", summary: { ...value } });
    return reply.send(value);
  });
}
