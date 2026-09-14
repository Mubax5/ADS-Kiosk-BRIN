import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export function WebsiteContent({ url, title }: { url: string; title: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setStatus("loading");
    const timer = window.setTimeout(() => setStatus((current) => current === "loading" ? "failed" : current), 12_000);
    return () => window.clearTimeout(timer);
  }, [url]);

  if (status === "failed") {
    return (
      <section className="kiosk-error-view">
        <h1>Konten belum dapat dibuka</h1>
        <p>Koneksi ke layanan sedang tidak tersedia atau situs tidak mengizinkan tampilan di dalam kiosk.</p>
        <div className="kiosk-qr-code"><QRCodeSVG value={url} size={300} level="M" includeMargin /></div>
        <p>Scan QR untuk membuka {title} di ponsel.</p>
        <button type="button" className="kiosk-primary-action" onClick={() => setStatus("loading")}>Coba Lagi</button>
      </section>
    );
  }

  return (
    <section className="kiosk-website-view">
      <div className="kiosk-website-toolbar">
        <strong>{title}</strong>
        <button type="button" onClick={() => setShowQr((value) => !value)}>{showQr ? "Tutup QR" : "Tampilkan QR"}</button>
      </div>
      {showQr ? <div className="kiosk-website-qr"><QRCodeSVG value={url} size={240} level="M" includeMargin /><span>Scan untuk membuka di ponsel</span></div> : null}
      <iframe
        title={title}
        src={url}
        sandbox="allow-forms allow-same-origin allow-scripts allow-popups"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("failed")}
      />
      {status === "loading" ? <div className="kiosk-loading">Memuat layanan…</div> : null}
    </section>
  );
}
