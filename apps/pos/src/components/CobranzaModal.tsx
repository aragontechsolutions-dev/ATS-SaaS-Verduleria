import { useEffect, useState } from 'react';
import type { MedioPago } from '../lib/types';
import type { Deudor } from '../lib/api';
import { getDeudores, postCobranza } from '../lib/api';
import { formatMoney } from '../lib/format';

interface Props {
  cashSessionId?: string;
  onDone: (monto: number, medio: MedioPago, cliente: string) => void;
  onClose: () => void;
}

const MEDIOS: Array<{ key: MedioPago; label: string }> = [
  { key: 'EFECTIVO', label: 'Efectivo' },
  { key: 'DEBITO', label: 'Débito' },
  { key: 'CREDITO', label: 'Crédito' },
  { key: 'MERCADO_PAGO', label: 'QR / MP' },
  { key: 'TRANSFERENCIA', label: 'Transferencia' },
];

/** Cobranza de cuenta corriente: elegir deudor, monto y medio; baja el saldo. */
export function CobranzaModal({ cashSessionId, onDone, onClose }: Props) {
  const [q, setQ] = useState('');
  const [deudores, setDeudores] = useState<Deudor[] | null>(null);
  const [sel, setSel] = useState<Deudor | null>(null);
  const [montoStr, setMontoStr] = useState('');
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sel) return; // en modo cobro no re-buscamos
    let vivo = true;
    const t = setTimeout(() => {
      getDeudores(q)
        .then((d) => { if (vivo) { setDeudores(d); setError(null); } })
        .catch(() => { if (vivo) setError('No se pudo buscar (¿sin conexión?).'); });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, sel]);

  function elegir(d: Deudor) {
    setSel(d);
    setMontoStr(d.saldo.toFixed(2));
  }

  const monto = parseFloat(montoStr.replace(',', '.')) || 0;
  const valido = !!sel && monto > 0 && monto <= (sel?.saldo ?? 0) + 0.005;

  async function confirmar() {
    if (!valido || !sel || enviando) return;
    if (!navigator.onLine) { setError('La cobranza necesita conexión.'); return; }
    setEnviando(true);
    setError(null);
    try {
      await postCobranza(sel.id, { monto, medio, cashSessionId });
      onDone(monto, medio, sel.nombre);
    } catch {
      setError('No se pudo registrar la cobranza.');
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide modal--tall">
        <div className="modal__head">
          <h3>Cobrar cuenta corriente</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
        </div>

        {!sel ? (
          <>
            <label className="field">
              Buscar deudor
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o documento…" autoFocus />
            </label>
            {error && <p className="modal__hint modal__hint--warn">{error}</p>}
            <div className="cust-list">
              {deudores === null && <p className="modal__hint">Buscando…</p>}
              {deudores?.length === 0 && <p className="empty">No hay clientes con deuda.</p>}
              {deudores?.map((d) => (
                <button key={d.id} className="cust-row" onClick={() => elegir(d)}>
                  <span className="cust-row__name">{d.nombre}</span>
                  <span className="cust-row__doc">Debe {formatMoney(d.saldo)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="cobranza-sel">
              <div>
                <div className="cobranza-sel__name">{sel.nombre}</div>
                <div className="cobranza-sel__saldo">Saldo: <strong>{formatMoney(sel.saldo)}</strong></div>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => { setSel(null); setError(null); }}>Cambiar</button>
            </div>

            <label className="field">
              Monto a cobrar
              <input
                type="number"
                inputMode="decimal"
                value={montoStr}
                onChange={(e) => setMontoStr(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && valido) confirmar(); }}
              />
            </label>
            <label className="field">
              Medio
              <select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
                {MEDIOS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            {medio === 'EFECTIVO' && !cashSessionId && (
              <p className="modal__hint modal__hint--warn">Sin caja abierta: el efectivo no se registrará en el arqueo.</p>
            )}
            {monto > sel.saldo + 0.005 && <p className="modal__hint modal__hint--warn">El monto supera la deuda.</p>}
            {error && <p className="modal__hint modal__hint--warn">{error}</p>}

            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
              <button className="btn btn--primary" onClick={confirmar} disabled={!valido || enviando}>
                {enviando ? 'Registrando…' : `Cobrar ${formatMoney(monto)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
