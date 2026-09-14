import { publishedManifestSchema, type PublishedManifest } from "@ads-kiosk/shared";

export type HeartbeatPayload = {
  softwareVersion: string;
  activeVersion: number | null;
  lastSyncStatus: "ok" | "offline" | "failed";
};

function deviceToken() {
  return import.meta.env.VITE_KIOSK_DEVICE_TOKEN?.trim() ?? "";
}

async function parseManifest(response: Response): Promise<PublishedManifest> {
  if (!response.ok) throw new Error(`Manifest request gagal: ${response.status}`);
  return publishedManifestSchema.parse(await response.json());
}

export async function fetchPublishedManifest(): Promise<PublishedManifest> {
  const token = deviceToken();
  if (!token) throw new Error("KIOSK_DEVICE_TOKEN_NOT_CONFIGURED");
  const response = await fetch("/api/v1/kiosk/manifest", {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseManifest(response);
}

export async function fetchPreviewManifest(): Promise<PublishedManifest> {
  const response = await fetch("/api/v1/admin/preview-manifest", {
    credentials: "same-origin",
    cache: "no-store",
  });
  return parseManifest(response);
}

export async function sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
  const token = deviceToken();
  if (!token) return;
  const response = await fetch("/api/v1/kiosk/heartbeat", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`Heartbeat gagal: ${response.status}`);
}

export function kioskSoftwareVersion() {
  return import.meta.env.VITE_KIOSK_SOFTWARE_VERSION?.trim() || "0.1.0";
}
