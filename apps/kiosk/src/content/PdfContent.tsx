import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export function PdfContent({ src, title }: { src: string; title: string }) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  return (
    <section className="kiosk-pdf-view">
      <div className="kiosk-pdf-toolbar">
        <strong>{title}</strong>
        <div className="kiosk-inline-actions" aria-label="Kontrol zoom PDF">
          <button type="button" onClick={() => setScale((value) => Math.max(0.7, Number((value - 0.15).toFixed(2))))}>Perkecil</button>
          <button type="button" onClick={() => setScale(1.1)}>Reset</button>
          <button type="button" onClick={() => setScale((value) => Math.min(2.2, Number((value + 0.15).toFixed(2))))}>Perbesar</button>
        </div>
      </div>
      <div className="kiosk-pdf-scroll">
        <Document file={src} loading={<div className="kiosk-loading">Memuat PDF…</div>} error={<div className="kiosk-error-inline">PDF tidak dapat dibuka.</div>} onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}>
          {Array.from({ length: numPages }, (_, index) => <Page key={index + 1} pageNumber={index + 1} scale={scale} />)}
        </Document>
      </div>
    </section>
  );
}
