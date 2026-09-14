import { Badge, LayerCard } from "@cloudflare/kumo";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { PublishPanel } from "../features/publish/PublishPanel";

type Dashboard = { publishedVersion: number | null; hasUnpublishedChanges: boolean };

export function PreviewPage() {
  const { csrfToken } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const refresh = useCallback(async () => setDashboard(await apiClient.get<Dashboard>("/api/v1/admin/dashboard")), []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function publish() {
    await apiClient.post("/api/v1/admin/publish", {}, csrfToken);
    await refresh();
  }

  return (
    <section className="cms-page">
      <header className="cms-page-header">
        <div><h1 className="cms-page-title">Preview</h1><p className="cms-page-description">Periksa draft seperti tampilan kiosk sebelum dipublish.</p></div>
        <div className="cms-inline-actions">
          <Badge>{dashboard?.hasUnpublishedChanges ? "Draft berubah" : "Tidak ada perubahan"}</Badge>
          <PublishPanel currentVersion={dashboard?.publishedVersion ?? null} hasChanges={dashboard?.hasUnpublishedChanges ?? false} onPublish={publish} />
        </div>
      </header>
      <LayerCard className="cms-preview-card">
        <iframe title="Preview Kiosk" className="cms-preview-frame" src="/kiosk/?preview=1" />
      </LayerCard>
    </section>
  );
}
