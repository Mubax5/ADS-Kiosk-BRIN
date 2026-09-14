import { LayerCard } from "@cloudflare/kumo";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { MediaLibrary, type MediaRecord } from "../features/media/MediaLibrary";

export function MediaPage() {
  const [items, setItems] = useState<MediaRecord[]>([]);
  const refresh = useCallback(async () => {
    const response = await apiClient.get<{ items: MediaRecord[] }>("/api/v1/admin/media");
    setItems(response.items);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <section className="cms-page">
      <header className="cms-page-header"><div><h1 className="cms-page-title">Media</h1><p className="cms-page-description">Satu perpustakaan untuk gambar, video, dan PDF yang digunakan konten.</p></div></header>
      <LayerCard className="cms-table-card"><MediaLibrary items={items} onChange={refresh} /></LayerCard>
    </section>
  );
}
