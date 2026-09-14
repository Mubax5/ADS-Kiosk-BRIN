import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { SqliteDatabase } from "../db/database.js";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function ensureKioskDevice(db: SqliteDatabase, deviceId: string, token?: string, name = "Kiosk Utama"): void {
  const current = db.prepare("SELECT credential_hash FROM kiosk_devices WHERE id = ?").get(deviceId) as { credential_hash: string | null } | undefined;
  const credentialHash = token ? hashDeviceToken(token) : null;
  if (!current) {
    db.prepare(`
      INSERT INTO kiosk_devices(id, name, credential_hash)
      VALUES (?, ?, ?)
    `).run(deviceId, name, credentialHash);
    return;
  }
  if (!current.credential_hash && credentialHash) {
    db.prepare("UPDATE kiosk_devices SET credential_hash = ? WHERE id = ?").run(credentialHash, deviceId);
  }
}

export function createKioskAuth(db: SqliteDatabase, deviceId: string) {
  return async function requireKiosk(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "Device credential required" });
      return;
    }

    const row = db.prepare("SELECT credential_hash FROM kiosk_devices WHERE id = ?").get(deviceId) as { credential_hash: string | null } | undefined;
    if (!row?.credential_hash) {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "Device is not provisioned" });
      return;
    }

    const expected = Buffer.from(row.credential_hash, "hex");
    const actual = Buffer.from(hashDeviceToken(token), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "Invalid device credential" });
    }
  };
}
