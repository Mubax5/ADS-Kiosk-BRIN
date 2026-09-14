import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { SqliteDatabase } from "./db/database.js";
import { registerAuthRoutes } from "./routes/auth.js";

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
};

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  app.decorate("db", options.db);
  app.decorateRequest("cmsUser");
  app.decorateRequest("cmsSession");

  await app.register(cookie, { secret: options.cookieSecret });
  await app.register(rateLimit, { global: false });

  app.get("/api/v1/health", async () => ({ ok: true }));
  await registerAuthRoutes(app, {
    cookieSecure: options.cookieSecure,
    sessionTtlHours: options.sessionTtlHours,
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (!reply.sent) {
      reply.code(error.statusCode && error.statusCode >= 400 ? error.statusCode : 500).send({
        error: error.statusCode && error.statusCode < 500 ? "REQUEST_ERROR" : "INTERNAL_ERROR",
        message: error.statusCode && error.statusCode < 500 ? error.message : "Internal server error",
      });
    }
  });

  return app;
}
