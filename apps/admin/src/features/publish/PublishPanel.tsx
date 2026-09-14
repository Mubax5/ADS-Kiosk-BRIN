import { Button, LayerDialog } from "@cloudflare/kumo";
import { useState } from "react";

export function PublishPanel({ currentVersion, hasChanges, onPublish }: { currentVersion: number | null; hasChanges: boolean; onPublish(): Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const nextVersion = (currentVersion ?? 0) + 1;

  async function publish() {
    setPublishing(true);
    try { await onPublish(); setOpen(false); } finally { setPublishing(false); }
  }

  return (
    <>
      <Button variant="primary" disabled={!hasChanges} onClick={() => setOpen(true)}>Publish ke Kiosk</Button>
      <LayerDialog.Root open={open} onOpenChange={(next) => !publishing && setOpen(next)} dismissDisabled={publishing}>
        <LayerDialog.Content closeLabel="Tutup">
          <LayerDialog.Title>{`Publish versi ${nextVersion}?`}</LayerDialog.Title>
          <LayerDialog.Description>Semua perubahan draft saat ini akan menjadi versi konten baru untuk kiosk.</LayerDialog.Description>
          <LayerDialog.Body>Kiosk baru mengaktifkan versi ini setelah seluruh file yang dibutuhkan berhasil diunduh dan diverifikasi.</LayerDialog.Body>
          <LayerDialog.Actions dismissLabel="Batal">
            <LayerDialog.Actions.Primary loading={publishing} onClick={() => void publish()}>Publish sekarang</LayerDialog.Actions.Primary>
          </LayerDialog.Actions>
        </LayerDialog.Content>
      </LayerDialog.Root>
    </>
  );
}
