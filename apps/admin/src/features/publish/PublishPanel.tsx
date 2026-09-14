import { Button, Dialog } from "@cloudflare/kumo";
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
    <Dialog.Root
      open={open}
      onOpenChange={(next) => { if (!publishing) setOpen(next); }}
      disablePointerDismissal={publishing}
    >
      <Dialog.Trigger render={(props) => <Button {...props} variant="primary" disabled={!hasChanges}>Publish ke Kiosk</Button>} />
      <Dialog className="p-6">
        <Dialog.Title>{`Publish versi ${nextVersion}?`}</Dialog.Title>
        <Dialog.Description>Semua perubahan draft saat ini akan menjadi versi konten baru untuk kiosk.</Dialog.Description>
        <p className="mt-4">Kiosk baru mengaktifkan versi ini setelah seluruh file yang dibutuhkan berhasil diunduh dan diverifikasi.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Dialog.Close render={(props) => <Button {...props} variant="secondary" disabled={publishing}>Batal</Button>} />
          <Button variant="primary" loading={publishing} onClick={() => void publish()}>Publish sekarang</Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
