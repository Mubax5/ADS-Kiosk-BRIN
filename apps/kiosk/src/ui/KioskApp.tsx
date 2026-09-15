import type { MenuItem, PublishedManifest } from "@ads-kiosk/shared";
import { useEffect, useMemo, useState } from "react";
import { ImageContent } from "../content/ImageContent";
import { PdfContent } from "../content/PdfContent";
import { QrContent } from "../content/QrContent";
import { TextContent } from "../content/TextContent";
import { VideoContent } from "../content/VideoContent";
import { WebsiteContent } from "../content/WebsiteContent";
import { createSessionMachine } from "../session/sessionMachine";
import { HomeScreen } from "./HomeScreen";
import { IdleScreen } from "./IdleScreen";
import { TimeoutWarning } from "./TimeoutWarning";

function mediaUrl(manifest: PublishedManifest, id: string) {
  return manifest.media.find((item) => item.id === id)?.url ?? null;
}

function ContentView({ manifest, item, onBack }: { manifest: PublishedManifest; item: MenuItem; onBack(): void }) {
  const config = item.content;
  let body: React.ReactNode;
  if (config.type === "website") body = <WebsiteContent url={config.url} title={config.title} />;
  else if (config.type === "qr") body = <QrContent url={config.url} title={config.title} instructions={config.instructions} />;
  else if (config.type === "text") body = <TextContent title={config.title} body={config.body} />;
  else {
    const src = mediaUrl(manifest, config.mediaId);
    if (!src) body = <section className="kiosk-error-view"><h1>Konten belum dapat dibuka</h1><p>File untuk layanan ini belum tersedia.</p></section>;
    else if (config.type === "pdf") body = <PdfContent src={src} title={config.title} />;
    else if (config.type === "image") body = <ImageContent src={src} caption={config.caption} />;
    else body = <VideoContent src={src} title={config.title} />;
  }

  return (
    <section className="kiosk-content-shell">
      <div className="kiosk-content-nav">
        <button type="button" aria-label="Kembali ke Menu" onClick={onBack}>← Kembali ke Menu</button>
        <div className="kiosk-content-brand" aria-label="BRIN">BRIN</div>
      </div>
      <div className="kiosk-content-body">{body}</div>
    </section>
  );
}

export function KioskApp({ manifest }: { manifest: PublishedManifest }) {
  const machine = useMemo(() => createSessionMachine({
    timeoutSeconds: manifest.settings.sessionTimeoutSeconds,
    warningSeconds: manifest.settings.sessionWarningSeconds,
  }), [manifest.settings.sessionTimeoutSeconds, manifest.settings.sessionWarningSeconds]);
  const [session, setSession] = useState(machine.snapshot());

  useEffect(() => {
    setSession(machine.reset());
    const interval = window.setInterval(() => setSession(machine.tick(Date.now())), 500);
    return () => window.clearInterval(interval);
  }, [machine, manifest.version]);

  const selected = session.selectedMenuId ? manifest.menuItems.find((item) => item.id === session.selectedMenuId) ?? null : null;
  const activeItems = manifest.menuItems.filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder);

  function visitorActivity() {
    if (session.state !== "idle") setSession(machine.activity(Date.now()));
  }
  function start() { setSession(machine.start(Date.now())); }
  function open(item: MenuItem) { setSession(machine.openContent(item.id, Date.now())); }
  function home() { setSession(machine.goHome(Date.now())); }

  const underlying = session.state === "idle"
    ? <IdleScreen manifest={manifest} onStart={start} />
    : selected
      ? <ContentView manifest={manifest} item={selected} onBack={home} />
      : <HomeScreen deviceName={manifest.settings.deviceDisplayName} items={activeItems} onOpen={open} />;

  return (
    <main className="kiosk-root" onPointerDown={visitorActivity}>
      {underlying}
      {session.state === "warning" ? <TimeoutWarning seconds={manifest.settings.sessionWarningSeconds} onContinue={visitorActivity} /> : null}
    </main>
  );
}
