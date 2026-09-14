import { createReadStream } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { MediaService } from "../media/mediaService.js";

export async function registerPublicMediaRoutes(app: FastifyInstance, mediaService: MediaService): Promise<void> {
  app.get<{ Params: { id: string } }>("/media/:id", async (request, reply) => {
    const record = mediaService.get(request.params.id);
    if (!record) return reply.code(404).send({ error: "NOT_FOUND", message: "Media tidak ditemukan" });

    reply.header("X-Content-Type-Options", "nosniff");
    reply.type(record.mimeType);
    return reply.send(createReadStream(mediaService.filePath(record)));
  });
}
