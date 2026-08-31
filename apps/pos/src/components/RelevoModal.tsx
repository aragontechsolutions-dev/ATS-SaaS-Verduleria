import { useEffect, useState } from 'react';
import { getTerminalOperadores, postRelevo } from '../lib/api';
import type { RelevoResult, TerminalOperador } from '../lib/api';
import { DenominationCounter } from './DenominationCounter';
import { formatMoney } from '../lib/format';

interface Props {
  terminalId: string;
  terminalNombre: string | null;
  /** userId del cajero saliente, para excluirlo de la lista de entrantes. */
  salienteUserId?: string;
  onDone: (r: RelevoResult) => void;
  onCancel: () => void;
}

/**
 * Relevo de cajero: el saliente cuenta el efectivo del cajón (arqueo ciego, sin
 * ver lo esperado) y elige al cajero entrante. Se cierra su turno y se abre el
 * del entrante en la misma caja con ese conteo como fondo.
 */
export function RelevoModal({ terminalId, terminalNombre, salienteUserId, onDone, onCancel }: Props) {
  const [operadores, setOperadores] = useState<TerminalOperador[]>([]);
  const [toUserId, setToUserId] = useState('');
  const [porDenom, setPorDenom] = useState(false);
  const [monto, setMonto] = useState('');
  const [denomTotal, setDenomTotal] = useState(0);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void getTerminalOperadores(terminalId)
      .then((list) => { if (vivo) setOperadores(list.filter((o) => o.userId !== salienteUserId)); })
      .catch(() => { if (vivo) setOperadores([]); });
    return () => { vivo = false; };
  }, [terminalId, salienteUserId]);

  const montoContado = porDenom ? denomTotal : parseFloat(monto.replace(',', '.')) || 0;
  const puede = !!toUserId && (porDenom ? denomTotal > 0 : monto.trim() !== '');

  async function confirmar() {
    if (!puede || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await postRelevo({ toUserId, montoContado, notas: notas.trim() || undefined });
      onDone(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Relevo de cajero</h3>
        <p className="modal__sub">
          {terminalNombre ? `${terminalNombre}. ` : ''}Contá el efectivo del cajón y elegí quién toma la caja. Tu turno se cierra con ese conteo.
        </p>

        <label className="field">
          Cajero entrante
          <select value={toUserId} onChange={(e) => { setToUserId(e.target.value); setError(null); }}>
            <option value="">Elegí…</option>
            {operadores.map((o) => <option key={o.userId} value={o.userId}>{o.nombre} · {o.role.toLowerCase()}</option>)}
          </select>
        </label>

        <div className="seg">
          <button type="button" className={`seg__btn ${!porDenom ? 'is-on' : ''}`} onClick={() => setPorDenom(false)}>Total</button>
          <button type="button" className={`seg__btn ${porDenom ? 'is-on' : ''}`} onClick={() => setPorDenom(true)}>Por denominación</button>
        </div>

        {porDenom ? (
          <DenominationCounter onTotal={setDenomTotal} />
        ) : (
          <label className="field">
            Efectivo contado en el cajón
            <input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Contado (a ciegas)"
              autoFocus
            />
          </label>
        )}

        <label className="field">
          Notas (opcional)
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="observaciones del relevo" />
        </label>

        <p className="modal__hint">El conteo es a ciegas: no se muestra el efectivo esperado. La diferencia queda registrada para el encargado.</p>
        {error && <p className="modal__err">{error}</p>}

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={guardando}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => void confirmar()} disabled={!puede || guardando}>
            {guardando ? 'Relevando…' : `Entregar${montoContado > 0 ? ` (${formatMoney(montoContado)})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
