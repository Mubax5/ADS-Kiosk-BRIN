import type { ContentConfig, ContentType, MenuItem } from "@ads-kiosk/shared";
import { Button, Input, InputArea, LayerCard, Select, Switch } from "@cloudflare/kumo";
import { useEffect, useMemo, useState, type FormEvent } from "react";

export type MediaOption = { id: string; originalName: string; category: "images" | "videos" | "pdf" | "documents"; mimeType: string };
type Props = { value: MenuItem; media: MediaOption[]; onSave(value: MenuItem): void | Promise<void>; onCancel?: (() => void) | undefined };
const typeItems: Record<ContentType, string> = { website: "Website", pdf: "PDF", qr: "QR Code", image: "Gambar", video: "Video", text: "Teks" };

type WebsiteContent = Extract<ContentConfig, { type: "website" }>;
type PdfContent = Extract<ContentConfig, { type: "pdf" }>;
type QrContent = Extract<ContentConfig, { type: "qr" }>;
type ImageContent = Extract<ContentConfig, { type: "image" }>;
type VideoContent = Extract<ContentConfig, { type: "video" }>;
type TextContent = Extract<ContentConfig, { type: "text" }>;

function contentFor(type: ContentType, currentName: string, media: MediaOption[]): ContentConfig {
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

  function chooseType(next: ContentType | null) { if (!next) return; const content = contentFor(next, draft.name, media); setDraft({ ...draft, contentType: next, content, mediaId: "mediaId" in content ? content.mediaId : null }); }
  function updateWebsite(patch: Partial<WebsiteContent>) { if (draft.content.type === "website") setDraft({ ...draft, content: { ...draft.content, ...patch } }); }
  function updateQr(patch: Partial<QrContent>) { if (draft.content.type === "qr") setDraft({ ...draft, content: { ...draft.content, ...patch } }); }
  function updateText(patch: Partial<TextContent>) { if (draft.content.type === "text") setDraft({ ...draft, content: { ...draft.content, ...patch } }); }
  function updatePdf(patch: Partial<PdfContent>) { if (draft.content.type === "pdf") { const content = { ...draft.content, ...patch }; setDraft({ ...draft, content, mediaId: content.mediaId }); } }
  function updateImage(patch: Partial<ImageContent>) { if (draft.content.type === "image") { const content = { ...draft.content, ...patch }; setDraft({ ...draft, content, mediaId: content.mediaId }); } }
  function updateVideo(patch: Partial<VideoContent>) { if (draft.content.type === "video") { const content = { ...draft.content, ...patch }; setDraft({ ...draft, content, mediaId: content.mediaId }); } }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { await onSave(draft); } finally { setSaving(false); } }

  return (
    <LayerCard className="cms-editor-card">
      <form className="cms-form" onSubmit={submit}>
        <div className="cms-form-grid">
          <Input label="Nama menu" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <Input label="Urutan" type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} required />
        </div>
        <InputArea label="Deskripsi" required={false} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value || null })} />
        <Select label="Jenis konten" value={draft.contentType} onValueChange={(next) => chooseType(next as ContentType | null)} items={typeItems} />

        {draft.content.type === "website" ? <div className="cms-form-grid"><Input label="Judul" value={draft.content.title} onChange={(e) => updateWebsite({ title: e.target.value })} /><Input label="URL" type="url" value={draft.content.url} onChange={(e) => updateWebsite({ url: e.target.value })} required /></div> : null}
        {draft.content.type === "qr" ? <><div className="cms-form-grid"><Input label="Judul" value={draft.content.title} onChange={(e) => updateQr({ title: e.target.value })} /><Input label="URL" type="url" value={draft.content.url} onChange={(e) => updateQr({ url: e.target.value })} required /></div><InputArea label="Petunjuk QR" value={draft.content.instructions} onChange={(e) => updateQr({ instructions: e.target.value })} /></> : null}
        {draft.content.type === "text" ? <><Input label="Judul" value={draft.content.title} onChange={(e) => updateText({ title: e.target.value })} /><InputArea label="Isi" value={draft.content.body} onChange={(e) => updateText({ body: e.target.value })} required /></> : null}
        {draft.content.type === "pdf" ? <><Input label="Judul" value={draft.content.title} onChange={(e) => updatePdf({ title: e.target.value })} /><Select label="Pilih PDF" value={draft.content.mediaId} onValueChange={(id) => { if (id) updatePdf({ mediaId: id }); }} items={mediaItems} /></> : null}
        {draft.content.type === "image" ? <><Select label="Pilih gambar" value={draft.content.mediaId} onValueChange={(id) => { if (id) updateImage({ mediaId: id }); }} items={mediaItems} /><InputArea label="Caption" required={false} value={draft.content.caption ?? ""} onChange={(e) => updateImage({ caption: e.target.value || null })} /></> : null}
        {draft.content.type === "video" ? <><Select label="Pilih video" value={draft.content.mediaId} onValueChange={(id) => { if (id) updateVideo({ mediaId: id }); }} items={mediaItems} /><Input label="Judul" required={false} value={draft.content.title ?? ""} onChange={(e) => updateVideo({ title: e.target.value || null })} /></> : null}
        <Switch label="Aktif" checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} />
        <div className="cms-actions">{onCancel ? <Button type="button" variant="secondary" onClick={onCancel}>Batal</Button> : null}<Button type="submit" variant="primary" loading={saving}>Simpan Draft</Button></div>
      </form>
    </LayerCard>
  );
}
