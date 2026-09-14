import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth/guards.js";
import { createSession, deleteSession } from "../auth/sessionService.js";
import { verifyPassword } from "../auth/password.js";
import { recordAudit } from "../services/auditService.js";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(1_000),
});

type AuthRouteOptions = {
  cookieSecure: boolean;
  sessionTtlHours: number;
};

export async function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): Promise<void> {
  app.post("/api/v1/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_REQUEST", message: "Username and password are required" });
    }

    const row = app.db.prepare(`
      SELECT id, username, password_hash, role, can_publish, active
      FROM users WHERE username = ? COLLATE NOCASE
    `).get(parsed.data.username) as {
      id: string;
      username: string;
      password_hash: string;
      role: "admin" | "editor";
      can_publish: number;
      active: number;
    } | undefined;

    const valid = row?.active ? await verifyPassword(parsed.data.password, row.password_hash) : false;
    if (!row || !valid) {
      recordAudit(app.db, {
        action: "auth.login_failed",
        targetType: "auth",
        summary: { username: parsed.data.username.slice(0, 120) },
      });
      return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Username atau password salah" });
    }

    const session = createSession(app.db, row.id, options.sessionTtlHours);
    recordAudit(app.db, { userId: row.id, action: "auth.login", targetType: "user", targetId: row.id });

    reply.setCookie("cms_session", session.id, {
      path: "/",
      signed: true,
      httpOnly: true,
      sameSite: "strict",
      secure: options.cookieSecure,
      maxAge: Math.floor(options.sessionTtlHours * 60 * 60),
    });

    return reply.send({ user: session.user, csrfToken: session.csrfToken });
  });

  app.get("/api/v1/auth/me", { preHandler: requireUser }, async (request) => ({
    user: request.cmsUser,
    csrfToken: request.cmsSession!.csrfToken,
  }));

  app.post("/api/v1/auth/logout", { preHandler: requireUser }, async (request, reply) => {
    const session = request.cmsSession!;
    deleteSession(app.db, session.id);
    recordAudit(app.db, { userId: request.cmsUser!.id, action: "auth.logout", targetType: "user", targetId: request.cmsUser!.id });
    reply.clearCookie("cms_session", { path: "/" });
    return reply.code(204).send();
  });
}
