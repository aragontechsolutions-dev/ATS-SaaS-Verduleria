import { useEffect, useState } from 'react';
import { cashSummary, closeCash } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { CashSummary } from '../lib/types';

interface Props {
  sessionId: string;
  onClosed: () => void;
  onCancel: () => void;
}

/** Arqueo y cierre de caja: muestra el esperado y calcula la diferencia. */
export function CloseCashModal({ sessionId, onClosed, onCancel }: Props) {
  const [resumen, setResumen] = useState<CashSummary | null>(null);
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    cashSummary(sessionId).then(setResumen).catch((e) => setError(String(e)));
  }, [sessionId]);

  const contado = parseFloat(valor.replace(',', '.')) || 0;
  const esperado = resumen?.efectivoEsperado ?? 0;
  const diferencia = contado - esperado;

  async function confirmar() {
    setCerrando(true);
    setError(null);
    try {
      await closeCash(sessionId, contado);
      onClosed();
    } catch (e) {
      setError(String(e));
      setCerrando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Cerrar caja (arqueo)</h3>
        {!resumen ? (
          <p className="modal__sub">{error ?? 'Calculando…'}</p>
        ) : (
          <>
            <div className="arqueo">
              <div className="arqueo__row">
                <span>Ventas</span>
                <span>{resumen.ventas}</span>
              </div>
              <div className="arqueo__row">
                <span>Total vendido</span>
                <span>{formatMoney(resumen.totalVendido)}</span>
              </div>
              {Object.entries(resumen.porMedio).map(([medio, monto]) => (
                <div className="arqueo__row arqueo__row--sub" key={medio}>
                  <span>{medio.toLowerCase().replace('_', ' ')}</span>
                  <span>{formatMoney(monto)}</span>
                </div>
              ))}
              <div className="arqueo__row arqueo__row--strong">
                <span>Efectivo esperado en caja</span>
                <span>{formatMoney(esperado)}</span>
              </div>
            </div>

            <label className="field">
              Efectivo contado ($)
              <input
                type="number"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                autoFocus
              />
            </label>
            <div className={`modal__total ${diferencia === 0 ? '' : diferencia > 0 ? 'ok' : 'warn'}`}>
              Diferencia: {formatMoney(diferencia)}
              {diferencia !== 0 && <small> ({diferencia > 0 ? 'sobra' : 'falta'})</small>}
            </div>
            {error && <p className="modal__err">{error}</p>}
          </>
        )}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={cerrando}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={confirmar} disabled={!resumen || cerrando}>
            {cerrando ? 'Cerrando…' : 'Cerrar caja'}
          </button>
        </div>
      </div>
    </div>
  );
}
