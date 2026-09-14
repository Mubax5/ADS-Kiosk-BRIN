import type { AdItem } from "@ads-kiosk/shared";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { AdsManager } from "../features/ads/AdsManager";
import type { MediaRecord } from "../features/media/MediaLibrary";

export function AdsPage() {
  const { csrfToken } = useAuth();
  const [items, setItems] = useState<AdItem[]>([]);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const refresh = useCallback(async () => {
    const [ads, files] = await Promise.all([
      apiClient.get<{ items: AdItem[] }>("/api/v1/admin/ads"),
      apiClient.get<{ items: MediaRecord[] }>("/api/v1/admin/media"),
    ]);
    setItems(ads.items);
    setMedia(files.items);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <section className="cms-page">
      <header className="cms-page-header"><div><h1 className="cms-page-title">Ads</h1><p className="cms-page-description">Atur playlist gambar dan video pada layar idle.</p></div></header>
      <AdsManager items={items} media={media} onSave={async (item) => { await apiClient.post("/api/v1/admin/ads", item, csrfToken); await refresh(); }} onDelete={async (item) => { await apiClient.delete(`/api/v1/admin/ads/${item.id}`, csrfToken); await refresh(); }} />
    </section>
  );
}
