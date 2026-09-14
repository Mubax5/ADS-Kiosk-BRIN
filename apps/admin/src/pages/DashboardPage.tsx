import { Badge, LayerCard } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

type DashboardData = {
  kiosk: null | { name: string; online: boolean; lastSeen: string | null; activeVersion: number | null; lastSyncStatus: string | null };
  publishedVersion: number | null;
  lastSync: string | null;
  hasUnpublishedChanges: boolean;
  menuCount: number;
  activeAdCount: number;
  mediaBytes: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatTime(value: string | null): string {
  if (!value) return "Belum ada";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<DashboardData>("/api/v1/admin/dashboard")
      .then((value) => { if (!cancelled) setData(value); })
      .catch(() => { if (!cancelled) setError("Status sistem belum dapat dimuat."); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="cms-page">
      <header className="cms-page-header">
        <div>
          <h1 className="cms-page-title">Dashboard</h1>
          <p className="cms-page-description">Status operasional kiosk dan konten yang sedang dikelola.</p>
        </div>
        {data ? <Badge>{data.hasUnpublishedChanges ? "Ada draft" : "Konten sinkron"}</Badge> : null}
      </header>

      {error ? <LayerCard className="cms-metric"><p role="alert">{error}</p></LayerCard> : null}
      {!data && !error ? <LayerCard className="cms-metric"><p>Memuat status…</p></LayerCard> : null}
      {data ? (
        <div className="cms-metric-grid">
          <LayerCard className="cms-metric">
            <p className="cms-metric-label">Kiosk</p>
            <p className="cms-metric-value">{data.kiosk?.online ? "Online" : "Offline"}</p>
            <p>{data.kiosk?.name ?? "Kiosk Utama"}</p>
          </LayerCard>
          <LayerCard className="cms-metric">
            <p className="cms-metric-label">Versi aktif</p>
            <p className="cms-metric-value">{data.publishedVersion ? `v${data.publishedVersion}` : "Belum publish"}</p>
            <p>Sinkron terakhir: {formatTime(data.lastSync)}</p>
          </LayerCard>
          <LayerCard className="cms-metric">
            <p className="cms-metric-label">Menu aktif</p>
            <p className="cms-metric-value">{data.menuCount}</p>
          </LayerCard>
          <LayerCard className="cms-metric">
            <p className="cms-metric-label">Ads aktif</p>
            <p className="cms-metric-value">{data.activeAdCount}</p>
          </LayerCard>
          <LayerCard className="cms-metric">
            <p className="cms-metric-label">Media</p>
            <p className="cms-metric-value">{formatBytes(data.mediaBytes)}</p>
          </LayerCard>
          <LayerCard className="cms-metric">
            <p className="cms-metric-label">Draft</p>
            <p className="cms-metric-value">{data.hasUnpublishedChanges ? "Belum dipublish" : "Tidak ada perubahan"}</p>
          </LayerCard>
        </div>
      ) : null}
    </section>
  );
}
