import type { MenuItem } from "@ads-kiosk/shared";

export function HomeScreen({ deviceName, items, onOpen }: { deviceName: string; items: MenuItem[]; onOpen(item: MenuItem): void }) {
  return (
    <section className="kiosk-home" aria-label="Menu layanan">
      <header className="kiosk-header">
        <div className="kiosk-brand-lockup" aria-label="Identitas BRIN">
          <span className="kiosk-brand-mark" aria-hidden="true">BRIN</span>
          <span className="kiosk-brand-name">Badan Riset dan Inovasi Nasional</span>
        </div>
        <div className="kiosk-device-name">{deviceName}</div>
      </header>

      <section className="kiosk-home-body" aria-label="Direktori layanan BRIN">
        <div className="kiosk-home-heading">
          <h1>Pilih layanan</h1>
          <p>Sentuh layanan yang ingin Anda akses.</p>
        </div>

        <div className="kiosk-service-directory">
          {items.map((item, index) => (
            <button key={item.id} type="button" className="kiosk-menu-button" aria-label={item.name} onClick={() => onOpen(item)}>
              <span className="kiosk-menu-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="kiosk-menu-copy" aria-hidden="true">
                <strong>{item.name}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              <span className="kiosk-menu-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
