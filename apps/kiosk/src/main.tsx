import type { PublishedManifest } from "@ads-kiosk/shared";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { fetchPreviewManifest, fetchPublishedManifest, kioskSoftwareVersion, sendHeartbeat, type HeartbeatPayload } from "./api/kioskClient";
import { browserVersionStateStore } from "./offline/db";
import { stageAndActivate } from "./offline/versionManager";
import { KioskApp } from "./ui/KioskApp";
import "./ui/kiosk.css";

type SyncStatus = HeartbeatPayload["lastSyncStatus"];

function KioskBootstrap() {
  const preview = useMemo(() => new URLSearchParams(window.location.search).get("preview") === "1", []);
  const [manifest, setManifest] = useState<PublishedManifest | null>(null);
  const [error, setError] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (preview) {
        try {
          const draft = await fetchPreviewManifest();
          if (!cancelled) {
            setManifest(draft);
            setSyncStatus("ok");
          }
        } catch {
          if (!cancelled) setError(true);
        }
        return;
      }

      if ("storage" in navigator && typeof navigator.storage.persist === "function") {
        void navigator.storage.persist().catch(() => false);
      }
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
      }

      const cached = await browserVersionStateStore.readActiveManifest().catch(() => null);
      if (cached && !cancelled) setManifest(cached);

      try {
        const published = await fetchPublishedManifest();
        const activation = await stageAndActivate(published);
        if (cancelled) return;
        if (activation.activated) {
          setManifest(published);
          setSyncStatus("ok");
          setError(false);
        } else {
          setSyncStatus("failed");
          if (!cached) setError(true);
        }
      } catch {
        if (!cancelled) {
          setSyncStatus("offline");
          if (!cached) setError(true);
        }
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [preview]);

  useEffect(() => {
    if (preview) return undefined;
    let stopped = false;

    async function heartbeat() {
      if (stopped) return;
      const activeVersion = await browserVersionStateStore.readActiveVersion().catch(() => null);
      await sendHeartbeat({ softwareVersion: kioskSoftwareVersion(), activeVersion, lastSyncStatus: syncStatus }).catch(() => undefined);
    }

    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [preview, syncStatus]);

  if (manifest) return <KioskApp manifest={manifest} />;
  if (error) return <main className="kiosk-root"><section className="kiosk-error-view"><h1>Kiosk belum siap</h1><p>Belum ada konten tersimpan yang dapat ditampilkan. Periksa koneksi dan konfigurasi perangkat kiosk.</p></section></main>;
  return <main className="kiosk-root"><div className="kiosk-loading">Menyiapkan kiosk…</div></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><KioskBootstrap /></StrictMode>);
