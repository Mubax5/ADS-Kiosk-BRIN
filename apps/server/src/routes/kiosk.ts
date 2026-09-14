import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { PublishService } from "../publish/publishService.js";
import { notFound, badRequest } from "../services/errors.js";

const heartbeatSchema = z.object({
  softwareVersion: z.string().trim().min(1).max(100),
  activeVersion: z.number().int().positive().nullable(),
  lastSyncStatus: z.string().trim().min(1).max(200),
});

export async function registerKioskRoutes(
  app: FastifyInstance,
  service: PublishService,
  deviceId: string,
  requireKiosk: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): Promise<void> {
  app.get("/api/v1/kiosk/manifest", { preHandler: requireKiosk }, async () => {
    const manifest = service.latest();
    if (!manifest) throw notFound("Belum ada konten yang dipublish");
    return manifest;
  });

  app.post("/api/v1/kiosk/heartbeat", { preHandler: requireKiosk }, async (request, reply) => {
    const parsed = heartbeatSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Heartbeat kiosk tidak valid");
    const now = new Date().toISOString();
    app.db.prepare(`
      UPDATE kiosk_devices
      SET software_version = ?, current_version = ?, last_sync_status = ?, last_seen_at = ?, last_sync_at = ?, last_ip = ?
      WHERE id = ?
    `).run(
      parsed.data.softwareVersion,
      parsed.data.activeVersion,
      parsed.data.lastSyncStatus,
      now,
      now,
      request.ip,
      deviceId,
    );
    return reply.code(204).send();
  });
}
