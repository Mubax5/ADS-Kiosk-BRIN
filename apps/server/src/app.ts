import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import type { SqliteDatabase } from "./db/database.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { createMediaService } from "./media/mediaService.js";
import { registerAdminMediaRoutes } from "./routes/adminMedia.js";
import { registerPublicMediaRoutes } from "./routes/media.js";
import { createSettingsService } from "./services/settingsService.js";
import { createMenuService } from "./services/menuService.js";
import { createAdService } from "./services/adService.js";
import { createUserService } from "./services/userService.js";
import { createDashboardService } from "./services/dashboardService.js";
import { registerAdminMenuRoutes } from "./routes/adminMenu.js";
import { registerAdminAdsRoutes } from "./routes/adminAds.js";
import { registerAdminSettingsRoutes } from "./routes/adminSettings.js";
import { registerAdminUserRoutes } from "./routes/adminUsers.js";
import { registerAdminDashboardRoute } from "./routes/adminDashboard.js";
import { createPublishService } from "./publish/publishService.js";
import { createKioskAuth, ensureKioskDevice } from "./auth/kioskAuth.js";
import { registerAdminPublishRoutes } from "./routes/adminPublish.js";
import { registerKioskRoutes } from "./routes/kiosk.js";

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
  kioskDeviceId?: string;
  kioskDeviceToken?: string | undefined;
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
  const settingsService = createSettingsService(app.db);
  const menuService = createMenuService(app.db, settingsService);
  const adService = createAdService(app.db, settingsService);
  const userService = createUserService(app.db);
  const dashboardService = createDashboardService(app.db, settingsService);
  const publishService = createPublishService(app.db, settingsService);
  const kioskDeviceId = options.kioskDeviceId ?? "kiosk-main";
  ensureKioskDevice(app.db, kioskDeviceId, options.kioskDeviceToken, settingsService.getKioskSettings().deviceDisplayName);
  const requireKiosk = createKioskAuth(app.db, kioskDeviceId);

  app.get("/api/v1/health", async () => ({ ok: true }));
  await registerAuthRoutes(app, {
    cookieSecure: options.cookieSecure,
    sessionTtlHours: options.sessionTtlHours,
  });
  await registerAdminMediaRoutes(app, mediaService);
  await registerPublicMediaRoutes(app, mediaService);
  await registerAdminMenuRoutes(app, menuService);
  await registerAdminAdsRoutes(app, adService);
  await registerAdminSettingsRoutes(app, settingsService);
  await registerAdminUserRoutes(app, userService);
  await registerAdminDashboardRoute(app, dashboardService);
  await registerAdminPublishRoutes(app, publishService);
  await registerKioskRoutes(app, publishService, kioskDeviceId, requireKiosk);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (reply.sent) return;

    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      && typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    const errorCode = typeof error === "object" && error !== null && "code" in error
      && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "REQUEST_ERROR";
    reply.code(statusCode >= 400 ? statusCode : 500).send({
      error: statusCode < 500 ? errorCode : "INTERNAL_ERROR",
      message: statusCode < 500 ? message : "Internal server error",
    });
  });

  return app;
}
