import { QRCodeSVG } from "qrcode.react";

export function QrContent({ url, title, instructions }: { url: string; title: string; instructions: string }) {
  return (
    <section className="kiosk-qr-view">
      <h1>{title}</h1>
      <div className="kiosk-qr-code"><QRCodeSVG value={url} size={360} level="M" includeMargin /></div>
      <p>{instructions}</p>
    </section>
  );
}
