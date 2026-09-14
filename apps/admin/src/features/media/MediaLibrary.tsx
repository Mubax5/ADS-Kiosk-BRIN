import { Badge, Button, Dialog, Table } from "@cloudflare/kumo";
import { useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";

export type MediaRecord = {
  id: string;
  originalName: string;
  storedName: string;
  category: "images" | "videos" | "pdf" | "documents";
  mimeType: string;
  byteSize: number;
  checksum: string;
  createdAt: string;
};

function prettyBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibrary({ items, onChange }: { items: MediaRecord[]; onChange(): Promise<void> | void }) {
  const { csrfToken } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [deleteItem, setDeleteItem] = useState<MediaRecord | null>(null);

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      await apiRequest("/api/v1/admin/media", { method: "POST", body: form }, csrfToken);
      await onChange();
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove() {
    if (!deleteItem) return;
    setBusy(true);
    try {
      await apiRequest(`/api/v1/admin/media/${deleteItem.id}`, { method: "DELETE" }, csrfToken);
      setDeleteItem(null);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="cms-toolbar">
        <input ref={fileInput} className="cms-file-input" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,application/pdf" aria-label="Pilih file media" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        <Button variant="primary" loading={busy} onClick={() => fileInput.current?.click()}>Upload Media</Button>
      </div>
      <Table>
        <Table.Header><Table.Row><Table.Head>File</Table.Head><Table.Head>Kategori</Table.Head><Table.Head>Ukuran</Table.Head><Table.Head>Aksi</Table.Head></Table.Row></Table.Header>
        <Table.Body>{items.map((item) => (
          <Table.Row key={item.id}>
            <Table.Cell>{item.originalName}</Table.Cell><Table.Cell><Badge>{item.category}</Badge></Table.Cell><Table.Cell>{prettyBytes(item.byteSize)}</Table.Cell>
            <Table.Cell><Button variant="secondary" onClick={() => setDeleteItem(item)}>Hapus</Button></Table.Cell>
          </Table.Row>
        ))}</Table.Body>
      </Table>
      <Dialog.Root open={Boolean(deleteItem)} onOpenChange={(next) => { if (!next && !busy) setDeleteItem(null); }} disablePointerDismissal={busy}>
        <Dialog className="p-6">
          <Dialog.Title>Hapus media?</Dialog.Title>
          <Dialog.Description>{deleteItem?.originalName}</Dialog.Description>
          <p className="mt-4">File yang masih digunakan draft atau versi terbit tidak dapat dihapus.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setDeleteItem(null)}>Batal</Button>
            <Button variant="destructive" loading={busy} onClick={() => void remove()}>Hapus</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}
