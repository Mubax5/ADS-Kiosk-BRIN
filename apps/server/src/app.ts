import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import { existsSync } from "node:fs";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { createKioskAuth, ensureKioskDevice } from "./auth/kioskAuth.js";
import type { SqliteDatabase } from "./db/database.js";
import { createMediaService } from "./media/mediaService.js";
import { createPublishService } from "./publish/publishService.js";
import { registerAdminAdsRoutes } from "./routes/adminAds.js";
import { registerAdminDashboardRoute } from "./routes/adminDashboard.js";
import { registerAdminMediaRoutes } from "./routes/adminMedia.js";
import { registerAdminMenuRoutes } from "./routes/adminMenu.js";
import { registerAdminPreviewRoute } from "./routes/adminPreview.js";
import { registerAdminPublishRoutes } from "./routes/adminPublish.js";
import { registerAdminSettingsRoutes } from "./routes/adminSettings.js";
import { registerAdminUserRoutes } from "./routes/adminUsers.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerKioskRoutes } from "./routes/kiosk.js";
import { registerPublicMediaRoutes } from "./routes/media.js";
import { createAdService } from "./services/adService.js";
import { createDashboardService } from "./services/dashboardService.js";
import { createMenuService } from "./services/menuService.js";
import { createSettingsService } from "./services/settingsService.js";
import { createUserService } from "./services/userService.js";

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
  loggerInstance?: FastifyBaseLogger;
  storagePath?: string;
  maxUploadBytes?: number;
  kioskDeviceId?: string;
  kioskDeviceToken?: string | undefined;
  adminDistPath?: string;
  kioskDistPath?: string;
};

const ADMIN_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const KIOSK_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; media-src 'self' blob:; connect-src 'self' https: http:; frame-src https: http:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";

async function registerStaticApps(app: FastifyInstance, adminDistPath?: string, kioskDistPath?: string) {
  if (!adminDistPath || !kioskDistPath || !existsSync(adminDistPath) || !existsSync(kioskDistPath)) return;

  await app.register(staticPlugin, {
    root: adminDistPath,
    prefix: "/admin/",
    wildcard: false,
    index: false,
    dotfiles: "deny",
  });
  await app.register(staticPlugin, {
    root: kioskDistPath,
    prefix: "/kiosk/",
    wildcard: false,
    index: false,
    dotfiles: "deny",
    decorateReply: false,
  });

  app.get("/admin/", async (_request, reply) => reply.sendFile("index.html", adminDistPath));
  app.get("/kiosk/", async (_request, reply) => reply.sendFile("index.html", kioskDistPath));
  app.get("/admin/*", async (_request, reply) => reply.sendFile("index.html", adminDistPath));
  app.get("/kiosk/*", async (_request, reply) => reply.sendFile("index.html", kioskDistPath));
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = options.loggerInstance
    ? Fastify({ loggerInstance: options.loggerInstance })
    : Fastify({ logger: options.logger ?? false });
  app.decorate("db", options.db);
  app.decorateRequest("cmsUser");
  app.decorateRequest("cmsSession");

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/admin")) reply.header("Content-Security-Policy", ADMIN_CSP);
    else if (request.url.startsWith("/kiosk")) reply.header("Content-Security-Policy", KIOSK_CSP);
    return payload;
  });

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
  await registerAdminPreviewRoute(app, settingsService);
  await registerKioskRoutes(app, publishService, kioskDeviceId, requireKiosk);
  await registerStaticApps(app, options.adminDistPath, options.kioskDistPath);

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: "NOT_FOUND", message: `Route ${request.method} ${request.url} not found` });
  });

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
