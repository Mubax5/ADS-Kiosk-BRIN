import type { ContentType, MenuItem } from "@ads-kiosk/shared";
import { Button, Input, InputArea, LayerCard, Select, Switch } from "@cloudflare/kumo";
import { useEffect, useMemo, useState, type FormEvent } from "react";

export type MediaOption = {
  id: string;
  originalName: string;
  category: "images" | "videos" | "pdf" | "documents";
  mimeType: string;
};

type Props = {
  value: MenuItem;
  media: MediaOption[];
  onSave(value: MenuItem): void | Promise<void>;
  onCancel?: (() => void) | undefined;
};

const typeItems: Record<ContentType, string> = {
  website: "Website",
  pdf: "PDF",
  qr: "QR Code",
  image: "Gambar",
  video: "Video",
  text: "Teks",
};

function contentFor(type: ContentType, currentName: string, media: MediaOption[]): MenuItem["content"] {
  if (type === "website") return { type, url: "https://", title: currentName };
  if (type === "qr") return { type, url: "https://", title: currentName, instructions: "Scan QR dengan ponsel Anda" };
  if (type === "text") return { type, title: currentName, body: "" };
  if (type === "pdf") return { type, title: currentName, mediaId: media.find((item) => item.category === "pdf")?.id ?? "00000000-0000-4000-8000-000000000000" };
  if (type === "image") return { type, mediaId: media.find((item) => item.category === "images")?.id ?? "00000000-0000-4000-8000-000000000000", caption: null };
  return { type, mediaId: media.find((item) => item.category === "videos")?.id ?? "00000000-0000-4000-8000-000000000000", title: currentName };
}

export function MenuEditor({ value, media, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<MenuItem>(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const mediaItems = useMemo(() => {
    const wanted = draft.content.type === "pdf" ? "pdf" : draft.content.type === "image" ? "images" : draft.content.type === "video" ? "videos" : null;
    return Object.fromEntries(media.filter((item) => !wanted || item.category === wanted).map((item) => [item.id, item.originalName]));
  }, [draft.content.type, media]);

  function chooseType(next: ContentType | null) {
    if (!next) return;
    const content = contentFor(next, draft.name, media);
    const mediaId = "mediaId" in content ? content.mediaId : null;
    setDraft({ ...draft, contentType: next, content, mediaId });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <LayerCard className="cms-editor-card">
      <form className="cms-form" onSubmit={submit}>
        <div className="cms-form-grid">
          <Input label="Nama menu" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <Input label="Urutan" type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} required />
        </div>
        <InputArea label="Deskripsi" required={false} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value || null })} />
        <Select label="Jenis konten" value={draft.contentType} onValueChange={(next) => chooseType(next as ContentType | null)} items={typeItems} />

        {draft.content.type === "website" ? (
          <div className="cms-form-grid">
            <Input label="Judul" value={draft.content.title} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, title: e.target.value } })} />
            <Input label="URL" type="url" value={draft.content.url} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, url: e.target.value } })} required />
          </div>
        ) : null}

        {draft.content.type === "qr" ? (
          <>
            <div className="cms-form-grid">
              <Input label="Judul" value={draft.content.title} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, title: e.target.value } })} />
              <Input label="URL" type="url" value={draft.content.url} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, url: e.target.value } })} required />
            </div>
            <InputArea label="Petunjuk QR" value={draft.content.instructions} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, instructions: e.target.value } })} />
          </>
        ) : null}

        {draft.content.type === "text" ? (
          <>
            <Input label="Judul" value={draft.content.title} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, title: e.target.value } })} />
            <InputArea label="Isi" value={draft.content.body} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, body: e.target.value } })} required />
          </>
        ) : null}

        {draft.content.type === "pdf" ? (
          <>
            <Input label="Judul" value={draft.content.title} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, title: e.target.value } })} />
            <Select
              label="Pilih PDF"
              value={draft.content.mediaId}
              onValueChange={(id) => id && setDraft({ ...draft, mediaId: id, content: { ...draft.content, mediaId: id } })}
              items={mediaItems}
            />
          </>
        ) : null}

        {draft.content.type === "image" ? (
          <>
            <Select
              label="Pilih gambar"
              value={draft.content.mediaId}
              onValueChange={(id) => id && setDraft({ ...draft, mediaId: id, content: { ...draft.content, mediaId: id } })}
              items={mediaItems}
            />
            <InputArea label="Caption" required={false} value={draft.content.caption ?? ""} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, caption: e.target.value || null } })} />
          </>
        ) : null}

        {draft.content.type === "video" ? (
          <>
            <Select
              label="Pilih video"
              value={draft.content.mediaId}
              onValueChange={(id) => id && setDraft({ ...draft, mediaId: id, content: { ...draft.content, mediaId: id } })}
              items={mediaItems}
            />
            <Input label="Judul" required={false} value={draft.content.title ?? ""} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, title: e.target.value || null } })} />
          </>
        ) : null}

        <Switch label="Aktif" checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} />
        <div className="cms-actions">
          {onCancel ? <Button type="button" variant="secondary" onClick={onCancel}>Batal</Button> : null}
          <Button type="submit" variant="primary" loading={saving}>Simpan Draft</Button>
        </div>
      </form>
    </LayerCard>
  );
}
