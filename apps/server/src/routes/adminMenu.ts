import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth/guards.js";
import type { ReturnTypeMenuService } from "../types/internal.js";
import { recordAudit } from "../services/auditService.js";

export async function registerAdminMenuRoutes(app: FastifyInstance, service: ReturnTypeMenuService): Promise<void> {
  app.get("/api/v1/admin/menu-items", { preHandler: requireUser }, async () => ({ items: service.list() }));
  app.post("/api/v1/admin/menu-items", { preHandler: requireUser }, async (request, reply) => {
    const item = service.save(request.body, request.cmsUser!.id);
    recordAudit(app.db, { userId: request.cmsUser!.id, action: "menu.create", targetType: "menu", targetId: item.id, summary: { name: item.name } });
    return reply.code(201).send(item);
  });
  app.put<{ Params: { id: string } }>("/api/v1/admin/menu-items/:id", { preHandler: requireUser }, async (request, reply) => {
    const body = typeof request.body === "object" && request.body ? { ...(request.body as object), id: request.params.id } : request.body;
    const item = service.save(body, request.cmsUser!.id);
    recordAudit(app.db, { userId: request.cmsUser!.id, action: "menu.edit", targetType: "menu", targetId: item.id, summary: { name: item.name } });
    return reply.send(item);
  });
  app.delete<{ Params: { id: string } }>("/api/v1/admin/menu-items/:id", { preHandler: requireUser }, async (request, reply) => {
    service.remove(request.params.id, request.cmsUser!.id);
    recordAudit(app.db, { userId: request.cmsUser!.id, action: "menu.delete", targetType: "menu", targetId: request.params.id });
    return reply.code(204).send();
  });
}
