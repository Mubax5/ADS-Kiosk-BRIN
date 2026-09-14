export function TimeoutWarning({ seconds = 10, onContinue }: { seconds?: number; onContinue(): void }) {
  return (
    <div className="kiosk-timeout-backdrop" role="dialog" aria-modal="true" aria-labelledby="timeout-title">
      <div className="kiosk-timeout-panel">
        <h2 id="timeout-title">Sesi akan berakhir dalam {seconds} detik</h2>
        <p>Sentuh tombol di bawah untuk melanjutkan menggunakan kiosk.</p>
        <button type="button" className="kiosk-primary-action" onClick={onContinue}>Lanjutkan</button>
      </div>
    </div>
  );
}
