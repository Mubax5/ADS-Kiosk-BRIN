import type { MenuItem } from "@ads-kiosk/shared";
import { Button, Dialog } from "@cloudflare/kumo";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { MenuEditor, type MediaOption } from "../features/menu/MenuEditor";
import { MenuTable } from "../features/menu/MenuTable";

const newItem = (): MenuItem => ({ id: crypto.randomUUID(), name: "Menu Baru", description: null, contentType: "text", content: { type: "text", title: "Menu Baru", body: "" }, mediaId: null, active: true, sortOrder: 99 });

export function MenuPage() {
  const { csrfToken } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [media, setMedia] = useState<MediaOption[]>([]);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const refresh = useCallback(async () => {
    const [menus, mediaResponse] = await Promise.all([apiClient.get<{ items: MenuItem[] }>("/api/v1/admin/menu-items"), apiClient.get<{ items: MediaOption[] }>("/api/v1/admin/media")]);
    setItems(menus.items); setMedia(mediaResponse.items);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function save(item: MenuItem) { if (creating) await apiClient.post("/api/v1/admin/menu-items", item, csrfToken); else await apiClient.put(`/api/v1/admin/menu-items/${item.id}`, item, csrfToken); setCreating(false); setEditing(null); await refresh(); }
  async function remove() { if (!deleting) return; await apiClient.delete(`/api/v1/admin/menu-items/${deleting.id}`, csrfToken); setDeleting(null); await refresh(); }
  return (
    <section className="cms-page">
      <header className="cms-page-header"><div><h1 className="cms-page-title">Menu & Konten</h1><p className="cms-page-description">Kelola layanan dan tipe konten yang tampil di kiosk.</p></div><Button variant="primary" onClick={() => { setCreating(true); setEditing(newItem()); }}>Tambah Menu</Button></header>
      {editing ? <MenuEditor value={editing} media={media} onSave={save} onCancel={() => { setEditing(null); setCreating(false); }} /> : <MenuTable items={items} onEdit={(item) => { setCreating(false); setEditing(item); }} onDelete={setDeleting} />}
      <Dialog.Root open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <Dialog className="p-6">
          <Dialog.Title>Hapus menu?</Dialog.Title>
          <Dialog.Description>{deleting?.name}</Dialog.Description>
          <p className="mt-4">Penghapusan mengubah draft. Kiosk tidak berubah sampai konten dipublish.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => void remove()}>Hapus</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </section>
  );
}
