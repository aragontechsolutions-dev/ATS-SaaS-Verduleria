import { useState } from 'react';
import {
  connectSerial,
  connectUsb,
  disconnect,
  isConnected,
  loadPrinterConfig,
  openDrawer,
  printTest,
  savePrinterConfig,
  serialSupported,
  usbSupported,
  type PrinterConfig,
  type PrinterMode,
} from '../lib/printer';

interface Props {
  onClose: () => void;
}

const BAUDS = [9600, 19200, 38400, 57600, 115200];

/** Configuración de la impresora térmica (ESC/POS) y del cajón de dinero. */
export function PrinterSettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<PrinterConfig>(() => loadPrinterConfig());
  const [conectada, setConectada] = useState(isConnected(config.mode));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function update(patch: Partial<PrinterConfig>) {
    const next = { ...config, ...patch };
    setConfig(next);
    savePrinterConfig(next);
    if (patch.mode) setConectada(isConnected(next.mode));
  }

  async function conectar() {
    setError(null);
    setOcupado(true);
    try {
      if (config.mode === 'usb') await connectUsb();
      else if (config.mode === 'serial') await connectSerial(config.baudRate);
      setConectada(isConnected(config.mode));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar.');
    } finally {
      setOcupado(false);
    }
  }

  async function accion(fn: () => Promise<void>, msgErr: string) {
    setError(null);
    setOcupado(true);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : msgErr); } finally { setOcupado(false); }
  }

  const esEscpos = config.mode !== 'browser';

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Impresora</h3>
        <p className="modal__sub">Se configura por dispositivo. ESC/POS requiere Chrome/Edge de escritorio.</p>

        <label className="field">
          Tipo de impresión
          <select value={config.mode} onChange={(e) => update({ mode: e.target.value as PrinterMode })}>
            <option value="browser">Navegador (HTML, cualquier impresora del sistema)</option>
            <option value="usb">Térmica ESC/POS por USB (WebUSB)</option>
            <option value="serial">Térmica ESC/POS por serie (Web Serial)</option>
          </select>
        </label>

        {esEscpos && (
          <>
            <div className="row2">
              <label className="field">
                Ancho del papel
                <select value={config.width} onChange={(e) => update({ width: Number(e.target.value) as 58 | 80 })}>
                  <option value={80}>80 mm</option>
                  <option value={58}>58 mm</option>
                </select>
              </label>
              {config.mode === 'serial' && (
                <label className="field">
                  Velocidad (baud)
                  <select value={config.baudRate} onChange={(e) => update({ baudRate: Number(e.target.value) })}>
                    {BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              )}
            </div>

            <label className="chk-row">
              <input type="checkbox" checked={config.openDrawer} onChange={(e) => update({ openDrawer: e.target.checked })} />
              Abrir el cajón al cobrar en efectivo
            </label>

            {config.mode === 'usb' && !usbSupported() && (
              <p className="modal__hint modal__hint--warn">Este navegador no soporta WebUSB. Usá Chrome/Edge de escritorio.</p>
            )}
            {config.mode === 'serial' && !serialSupported() && (
              <p className="modal__hint modal__hint--warn">Este navegador no soporta Web Serial. Usá Chrome/Edge de escritorio.</p>
            )}

            <div className="scale-live">
              <span className={`scale-status ${conectada ? 'is-on' : ''}`}>{conectada ? '● Conectada' : '○ Desconectada'}</span>
            </div>
            {error && <p className="modal__hint modal__hint--warn">{error}</p>}

            <div className="modal__actions modal__actions--wrap">
              {conectada ? (
                <button className="btn btn--ghost" disabled={ocupado} onClick={() => void accion(async () => { await disconnect(); setConectada(false); }, 'No se pudo desconectar.')}>
                  Desconectar
                </button>
              ) : (
                <button className="btn btn--primary" disabled={ocupado} onClick={() => void conectar()}>Conectar</button>
              )}
              <button className="btn btn--ghost" disabled={ocupado || !conectada} onClick={() => void accion(() => printTest(config), 'No se pudo imprimir la prueba.')}>
                Imprimir prueba
              </button>
              <button className="btn btn--ghost" disabled={ocupado || !conectada} onClick={() => void accion(() => openDrawer(config), 'No se pudo abrir el cajón.')}>
                Abrir cajón
              </button>
            </div>
          </>
        )}

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
