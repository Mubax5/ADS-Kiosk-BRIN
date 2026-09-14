import type { PublishedManifest } from "@ads-kiosk/shared";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { KioskApp } from "./ui/KioskApp";
import "./ui/kiosk.css";

function KioskBootstrap() {
  const [manifest, setManifest] = useState<PublishedManifest | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/kiosk/manifest", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`manifest ${response.status}`);
        return response.json() as Promise<PublishedManifest>;
      })
      .then((value) => { if (!cancelled) setManifest(value); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (manifest) return <KioskApp manifest={manifest} />;
  if (error) return <main className="kiosk-root"><section className="kiosk-error-view"><h1>Kiosk belum siap</h1><p>Konten belum dapat dimuat. Sistem akan mencoba kembali setelah koneksi tersedia.</p></section></main>;
  return <main className="kiosk-root"><div className="kiosk-loading">Menyiapkan kiosk…</div></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><KioskBootstrap /></StrictMode>);
