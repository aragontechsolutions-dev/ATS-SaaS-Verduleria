import { useState } from 'react';
import type { ScaleState } from '../hooks/useScale';
import type { ScaleMode, ScaleProtocol } from '../lib/scale';
import type { EmbeddedKind, WeightBarcodeConfig } from '../lib/barcode';
import { parseScan } from '../lib/barcode';

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

  // Actualiza un campo del formato del código de peso variable.
  const setBc = (patch: Partial<WeightBarcodeConfig>) =>
    setConfig({ ...config, barcode: { ...config.barcode, ...patch } });

  return (
    <div className="modal-backdrop">
      <div className="modal">
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

        {config.mode === 'barcode' && <BarcodeSettings bc={config.barcode} setBc={setBc} />}

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

/**
 * Config del formato del EAN de peso variable + un probador. Los defaults son
 * los más comunes (prefijo 20–29, PLU 5 díg, peso 5 díg con 3 decimales), que
 * funcionan con la mayoría de las balanzas etiquetadoras (Systel, Kretz, etc.).
 */
function BarcodeSettings({ bc, setBc }: { bc: WeightBarcodeConfig; setBc: (p: Partial<WeightBarcodeConfig>) => void }) {
  const [prueba, setPrueba] = useState('');
  const r = prueba.trim() ? parseScan(prueba.trim(), bc) : null;

  return (
    <div className="bc">
      <label className="field">
        Qué imprime la etiqueta
        <select value={bc.embedded} onChange={(e) => setBc({ embedded: e.target.value as EmbeddedKind })}>
          <option value="weight">Peso (recomendado — el precio sale del catálogo)</option>
          <option value="price">Importe ya calculado por la balanza</option>
        </select>
      </label>

      <div className="row2">
        <label className="field">
          Dígitos del PLU
          <input type="number" min={3} max={7} value={bc.pluDigits} onChange={(e) => setBc({ pluDigits: clampInt(e.target.value, 3, 7) })} />
        </label>
        <label className="field">
          Dígitos del {bc.embedded === 'weight' ? 'peso' : 'importe'}
          <input type="number" min={4} max={6} value={bc.valueDigits} onChange={(e) => setBc({ valueDigits: clampInt(e.target.value, 4, 6) })} />
        </label>
      </div>

      <div className="row2">
        <label className="field">
          Decimales del peso
          <input type="number" min={0} max={3} value={bc.weightDecimals} onChange={(e) => setBc({ weightDecimals: clampInt(e.target.value, 0, 3) })} />
        </label>
        <label className="field">
          Decimales del importe
          <input type="number" min={0} max={3} value={bc.priceDecimals} onChange={(e) => setBc({ priceDecimals: clampInt(e.target.value, 0, 3) })} />
        </label>
      </div>

      <label className="field">
        Prefijos de peso variable (2 díg, separados por coma)
        <input
          value={bc.prefixes.join(', ')}
          onChange={(e) => setBc({ prefixes: parsePrefixes(e.target.value) })}
          placeholder="20, 21, 22, …, 29"
        />
      </label>

      <label className="chk-row">
        <input type="checkbox" checked={bc.validateCheckDigit} onChange={(e) => setBc({ validateCheckDigit: e.target.checked })} />
        Validar dígito verificador del EAN‑13
      </label>

      {/* Probador: escaneá/pegá una etiqueta de la balanza y verificá la lectura */}
      <label className="field">
        Probar una etiqueta
        <input value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="Escaneá o pegá el código impreso" />
      </label>
      {r && (
        <p className={`bc__res ${r.type === 'weight' ? 'ok' : 'warn'}`}>
          {r.type === 'weight'
            ? `✓ PLU ${r.plu} · ${r.kind === 'weight' ? `${r.weightKg?.toFixed(3)} kg` : `importe $${r.price?.toFixed(2)}`}`
            : r.type === 'ean'
              ? `EAN normal (se busca por código de barras): ${r.code}`
              : '⚠ No reconocido: revisá los dígitos/prefijos del formato.'}
        </p>
      )}
      <p className="modal__hint">
        Cada producto pesable debe tener el mismo <strong>PLU</strong> en el Panel y en la balanza. Ante la duda, dejá los valores por defecto.
      </p>
    </div>
  );
}

function clampInt(v: string, min: number, max: number): number {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parsePrefixes(v: string): string[] {
  const out = v
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{2}$/.test(s));
  return out.length ? [...new Set(out)] : ['20'];
}
