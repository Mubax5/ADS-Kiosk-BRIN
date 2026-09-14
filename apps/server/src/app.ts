import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import type { SqliteDatabase } from "./db/database.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { createMediaService } from "./media/mediaService.js";
import { registerAdminMediaRoutes } from "./routes/adminMedia.js";
import { registerPublicMediaRoutes } from "./routes/media.js";

declare module "fastify" {
  interface FastifyInstance {
    db: SqliteDatabase;
  }
}

export type BuildAppOptions = {
  db: SqliteDatabase;
  cookieSecret: string;
  cookieSecure: boolean;
  sessionTtlHours: number;
  logger?: boolean;
  storagePath?: string;
  maxUploadBytes?: number;
};

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  app.decorate("db", options.db);
  app.decorateRequest("cmsUser");
  app.decorateRequest("cmsSession");

  await app.register(cookie, { secret: options.cookieSecret });
  await app.register(rateLimit, { global: false });
  const maxUploadBytes = options.maxUploadBytes ?? 524_288_000;
  await app.register(multipart, { limits: { fileSize: maxUploadBytes, files: 1, parts: 1 }, throwFileSizeLimit: true });
  const mediaService = createMediaService(app.db, options.storagePath ?? "./storage", maxUploadBytes);

  app.get("/api/v1/health", async () => ({ ok: true }));
  await registerAuthRoutes(app, {
    cookieSecure: options.cookieSecure,
    sessionTtlHours: options.sessionTtlHours,
  });
  await registerAdminMediaRoutes(app, mediaService);
  await registerPublicMediaRoutes(app, mediaService);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (reply.sent) return;

    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      && typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    reply.code(statusCode >= 400 ? statusCode : 500).send({
      error: statusCode < 500 ? "REQUEST_ERROR" : "INTERNAL_ERROR",
      message: statusCode < 500 ? message : "Internal server error",
    });
  });

  return app;
}
