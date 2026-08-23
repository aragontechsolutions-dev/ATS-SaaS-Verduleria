import type { ScaleState } from '../hooks/useScale';
import type { ScaleMode, ScaleProtocol } from '../lib/scale';

interface Props {
  scale: ScaleState;
  onClose: () => void;
}

const MODES: Array<{ value: ScaleMode; label: string; hint: string }> = [
  { value: 'manual', label: 'Manual', hint: 'La balanza solo muestra el peso; el cajero lo escribe.' },
  { value: 'barcode', label: 'Etiqueta con código', hint: 'La balanza imprime un EAN con el peso; se escanea.' },
  { value: 'serial', label: 'En vivo (COM/USB)', hint: 'Lee el peso en vivo por puerto serie (Web Serial).' },
  { value: 'network', label: 'En vivo (red/UTP)', hint: 'Lee el peso desde un puente local por WebSocket.' },
];

const BAUDS = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

export function ScaleSettingsModal({ scale, onClose }: Props) {
  const { config, setConfig, serialSupported, connected, reading, error, connect, disconnect } = scale;
  const modeInfo = MODES.find((m) => m.value === config.mode);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Balanza</h3>
        <p className="modal__sub">Se configura por dispositivo. Elegí lo que tenés en esta caja.</p>

        <label className="field">
          Tipo de balanza
          <select
            value={config.mode}
            onChange={(e) => setConfig({ ...config, mode: e.target.value as ScaleMode })}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {modeInfo && <p className="modal__hint">{modeInfo.hint}</p>}

        {(config.mode === 'serial' || config.mode === 'network') && (
          <>
            <label className="field">
              Protocolo
              <select
                value={config.protocol}
                onChange={(e) => setConfig({ ...config, protocol: e.target.value as ScaleProtocol })}
              >
                <option value="generic">Genérico (texto con número)</option>
                <option value="toledo">Toledo / Mettler (ST,GS,…)</option>
              </select>
            </label>

            {config.mode === 'serial' && (
              <label className="field">
                Velocidad (baud)
                <select
                  value={config.baudRate}
                  onChange={(e) => setConfig({ ...config, baudRate: Number(e.target.value) })}
                >
                  {BAUDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {config.mode === 'network' && (
              <label className="field">
                URL del puente
                <input
                  value={config.networkUrl}
                  onChange={(e) => setConfig({ ...config, networkUrl: e.target.value })}
                  placeholder="ws://localhost:8787"
                />
              </label>
            )}

            {config.mode === 'serial' && !serialSupported && (
              <p className="modal__hint modal__hint--warn">
                Este navegador no soporta Web Serial. Usá Chrome o Edge de escritorio.
              </p>
            )}

            <div className="scale-live">
              <span className={`scale-status ${connected ? 'is-on' : ''}`}>
                {connected ? '● Conectada' : '○ Desconectada'}
              </span>
              {reading && (
                <span className={`scale-live__w ${reading.stable ? 'is-stable' : ''}`}>
                  {reading.weightKg.toFixed(3)} kg {reading.stable ? '' : '(…)'}
                </span>
              )}
            </div>
            {error && <p className="modal__hint modal__hint--warn">{error}</p>}

            <div className="modal__actions">
              {connected ? (
                <button className="btn btn--ghost" onClick={() => void disconnect()}>
                  Desconectar
                </button>
              ) : (
                <button className="btn btn--primary" onClick={() => void connect()}>
                  Conectar balanza
                </button>
              )}
            </div>
          </>
        )}

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
