import type { CmsUser } from "@ads-kiosk/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession, type CmsSession } from "./sessionService.js";

declare module "fastify" {
  interface FastifyRequest {
    cmsUser?: CmsUser;
    cmsSession?: CmsSession;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function unauthorized(reply: FastifyReply, message = "Authentication required") {
  return reply.code(401).send({ error: "UNAUTHORIZED", message });
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawCookie = request.cookies.cms_session;
  if (!rawCookie) {
    unauthorized(reply);
    return;
  }

  const unsigned = request.unsignCookie(rawCookie);
  if (!unsigned.valid) {
    unauthorized(reply, "Invalid session");
    return;
  }

  const session = getSession(request.server.db, unsigned.value);
  if (!session) {
    unauthorized(reply, "Session expired or invalid");
    return;
  }

  request.cmsSession = session;
  request.cmsUser = session.user;

  if (!SAFE_METHODS.has(request.method)) {
    const csrf = request.headers["x-csrf-token"];
    if (typeof csrf !== "string" || csrf !== session.csrfToken) {
      reply.code(403).send({ error: "CSRF_INVALID", message: "Invalid CSRF token" });
    }
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(request, reply);
  if (reply.sent) return;
  if (request.cmsUser?.role !== "admin") {
    reply.code(403).send({ error: "FORBIDDEN", message: "Administrator access required" });
  }
}

export async function requirePublisher(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(request, reply);
  if (reply.sent) return;
  const user = request.cmsUser;
  if (!user || (user.role !== "admin" && !user.canPublish)) {
    reply.code(403).send({ error: "FORBIDDEN", message: "Publish permission required" });
  }
}
