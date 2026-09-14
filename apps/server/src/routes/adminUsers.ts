import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth/guards.js";
import type { ReturnTypeUserService } from "../types/internal.js";
import { recordAudit } from "../services/auditService.js";

export async function registerAdminUserRoutes(app: FastifyInstance, service: ReturnTypeUserService): Promise<void> {
  app.get("/api/v1/admin/users", { preHandler: requireAdmin }, async () => ({ items: service.list() }));
  app.post("/api/v1/admin/users", { preHandler: requireAdmin }, async (request, reply) => {
    const user = await service.create(request.body);
    recordAudit(app.db, { userId: request.cmsUser!.id, action: "user.create", targetType: "user", targetId: user.id, summary: { username: user.username, role: user.role } });
    return reply.code(201).send(user);
  });
  app.patch<{ Params: { id: string } }>("/api/v1/admin/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const user = await service.update(request.params.id, request.body);
    recordAudit(app.db, { userId: request.cmsUser!.id, action: "user.edit", targetType: "user", targetId: user.id, summary: { username: user.username, role: user.role, active: user.active, canPublish: user.canPublish } });
    return reply.send(user);
  });
}
