import type { MenuItem } from "@ads-kiosk/shared";

export function HomeScreen({ deviceName, items, onOpen }: { deviceName: string; items: MenuItem[]; onOpen(item: MenuItem): void }) {
  return (
    <section className="kiosk-home" aria-label="Menu layanan">
      <header className="kiosk-header">
        <div className="kiosk-brand">BRIN</div>
        <div className="kiosk-device-name">{deviceName}</div>
      </header>
      <div className="kiosk-home-body">
        <h1>Pilih layanan</h1>
        <div className="kiosk-menu-grid">
          {items.map((item) => (
            <button key={item.id} type="button" className="kiosk-menu-button" onClick={() => onOpen(item)}>
              <span>{item.name}</span>
              {item.description ? <small>{item.description}</small> : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
