import type { PublishedManifest } from "@ads-kiosk/shared";
import { useEffect, useMemo, useState } from "react";

function isCurrent(startsAt: string | null, endsAt: string | null, now: number) {
  if (startsAt && Date.parse(startsAt) > now) return false;
  if (endsAt && Date.parse(endsAt) <= now) return false;
  return true;
}

export function IdleScreen({ manifest, onStart }: { manifest: PublishedManifest; onStart(): void }) {
  const ads = useMemo(() => manifest.ads.filter((ad) => isCurrent(ad.startsAt, ad.endsAt, Date.now())), [manifest.ads]);
  const [index, setIndex] = useState(0);
  const ad = ads.length ? ads[index % ads.length] : null;
  const media = ad ? manifest.media.find((item) => item.id === ad.mediaId) ?? null : null;

  useEffect(() => {
    setIndex(0);
  }, [manifest.version]);

  useEffect(() => {
    if (!ad || !media || ad.mediaType === "video") return undefined;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), (ad.displayDurationSeconds ?? 10) * 1_000);
    return () => window.clearTimeout(timer);
  }, [ad, media]);

  return (
    <section className="kiosk-idle" aria-label="Layar informasi">
      <div className="kiosk-idle-media" aria-hidden="true">
        {!media ? (
          <div className="kiosk-idle-fallback">
            <div className="kiosk-idle-brand">BRIN</div>
            <div className="kiosk-idle-copy">
              <strong>Badan Riset dan Inovasi Nasional</strong>
              <span>Informasi dan layanan publik</span>
            </div>
          </div>
        ) : null}
        {media && ad?.mediaType === "image" ? <img src={media.url} alt="" /> : null}
        {media && ad?.mediaType === "video" ? (
          <video key={`${manifest.version}-${ad.id}`} src={media.url} autoPlay muted playsInline onEnded={() => setIndex((value) => value + 1)} />
        ) : null}
      </div>
      <div className="kiosk-start-panel">
        <div className="kiosk-start-copy">
          <strong>Layanan BRIN</strong>
          <span>Akses informasi dan layanan dari layar ini.</span>
        </div>
        <button type="button" className="kiosk-start-button" onClick={onStart}>Sentuh untuk Mulai</button>
      </div>
    </section>
  );
}
