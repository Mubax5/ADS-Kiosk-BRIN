export function ImageContent({ src, caption }: { src: string; caption: string | null }) {
  return (
    <figure className="kiosk-media-view">
      <img src={src} alt={caption ?? "Informasi visual"} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
