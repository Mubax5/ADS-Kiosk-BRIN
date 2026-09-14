import { useRef } from "react";

export function VideoContent({ src, title }: { src: string; title: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  return (
    <section className="kiosk-video-view">
      {title ? <h1>{title}</h1> : null}
      <video ref={video} src={src} controls playsInline />
      <div className="kiosk-inline-actions">
        <button type="button" onClick={() => void video.current?.play()}>Putar</button>
        <button type="button" onClick={() => video.current?.pause()}>Jeda</button>
        <button type="button" onClick={() => { if (video.current) { video.current.currentTime = 0; void video.current.play(); } }}>Ulangi</button>
      </div>
    </section>
  );
}
