import type { AdItem } from "@ads-kiosk/shared";
import { Badge, Button, Input, LayerCard, Select, Table } from "@cloudflare/kumo";
import { useMemo, useState, type FormEvent } from "react";
import type { MediaRecord } from "../media/MediaLibrary";

export function AdsManager({ items, media, onSave, onDelete }: {
  items: AdItem[];
  media: MediaRecord[];
  onSave(item: AdItem): Promise<void>;
  onDelete(item: AdItem): Promise<void>;
}) {
  const eligible = useMemo(() => media.filter((item) => item.category === "images" || item.category === "videos"), [media]);
  const mediaItems = useMemo(() => Object.fromEntries(eligible.map((item) => [item.id, item.originalName])), [eligible]);
  const [mediaId, setMediaId] = useState<string | null>(eligible[0]?.id ?? null);
  const [duration, setDuration] = useState(10);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!mediaId) return;
    const selected = eligible.find((item) => item.id === mediaId);
    if (!selected) return;
    setBusy(true);
    try {
      await onSave({
        id: crypto.randomUUID(),
        mediaId,
        mediaType: selected.category === "images" ? "image" : "video",
        active: true,
        sortOrder: items.length + 1,
        displayDurationSeconds: selected.category === "images" ? duration : null,
        startsAt: null,
        endsAt: null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cms-stack">
      <LayerCard className="cms-editor-card">
        <form className="cms-form" onSubmit={add}>
          <div className="cms-form-grid">
            <Select label="Media Ads" placeholder="Pilih media" value={mediaId} onValueChange={setMediaId} items={mediaItems} />
            <Input label="Durasi gambar (detik)" type="number" min={3} max={3600} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="cms-actions"><Button type="submit" variant="primary" loading={busy} disabled={!mediaId}>Tambah ke Playlist</Button></div>
        </form>
      </LayerCard>
      <LayerCard className="cms-table-card">
        <Table>
          <Table.Header><Table.Row><Table.Head>Urutan</Table.Head><Table.Head>Media</Table.Head><Table.Head>Status</Table.Head><Table.Head>Durasi</Table.Head><Table.Head>Aksi</Table.Head></Table.Row></Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>{item.sortOrder}</Table.Cell>
                <Table.Cell>{media.find((entry) => entry.id === item.mediaId)?.originalName ?? item.mediaId}</Table.Cell>
                <Table.Cell><Badge>{item.active ? "Aktif" : "Nonaktif"}</Badge></Table.Cell>
                <Table.Cell>{item.mediaType === "video" ? "Sesuai video" : `${item.displayDurationSeconds ?? 10} detik`}</Table.Cell>
                <Table.Cell><Button variant="secondary" onClick={() => void onDelete(item)}>Hapus</Button></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
    </div>
  );
}
