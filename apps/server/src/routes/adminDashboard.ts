import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth/guards.js";
import type { ReturnTypeDashboardService } from "../types/internal.js";

export async function registerAdminDashboardRoute(app: FastifyInstance, service: ReturnTypeDashboardService): Promise<void> {
  app.get("/api/v1/admin/dashboard", { preHandler: requireUser }, async () => service.get());
}
