import { useEffect, useMemo, useState } from 'react';
import { cashSummary, closeCash } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { CashSummary } from '../lib/types';

interface Props {
  sessionId: string;
  onClosed: () => void;
  onCancel: () => void;
}

const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: '💵 Efectivo',
  DEBITO: '💳 Débito',
  CREDITO: '💳 Crédito',
  MERCADO_PAGO: '📱 QR / MP',
  TRANSFERENCIA: '🏦 Transferencia',
  DINERO_ELECTRONICO: '💠 Dinero electrónico',
  CUENTA_CORRIENTE: '📒 Cuenta corriente',
};
const label = (m: string) => MEDIO_LABEL[m] ?? m.toLowerCase().replace(/_/g, ' ');

const parse = (v: string) => parseFloat(v.replace(',', '.')) || 0;

/**
 * Arqueo y cierre de caja: además del efectivo físico, concilia cada medio de
 * pago electrónico (lo que liquida la terminal/banco) contra lo del sistema.
 */
export function CloseCashModal({ sessionId, onClosed, onCancel }: Props) {
  const [resumen, setResumen] = useState<CashSummary | null>(null);
  const [efectivo, setEfectivo] = useState('');
  // Conteo/liquidación por medio electrónico (texto por input).
  const [conteos, setConteos] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    cashSummary(sessionId).then(setResumen).catch((e) => setError(String(e)));
  }, [sessionId]);

  // Medios electrónicos usados (todos menos efectivo), para conciliar uno a uno.
  const electronicos = useMemo(
    () => Object.keys(resumen?.porMedio ?? {}).filter((m) => m !== 'EFECTIVO').sort(),
    [resumen],
  );

  const efectivoContado = parse(efectivo);
  const efectivoEsperado = resumen?.efectivoEsperado ?? 0;
  const difEfectivo = efectivoContado - efectivoEsperado;

  // Obliga a contar el efectivo antes de cerrar (no permite cerrar en blanco).
  const efectivoIngresado = efectivo.trim() !== '';

  // ¿Hay diferencia en efectivo o en algún medio? (a nivel de centavos).
  const cent = (n: number) => Math.round(n * 100);
  const difMediosCent = electronicos.reduce((acc, m) => {
    const esperado = resumen?.porMedio[m] ?? 0;
    const contado = conteos[m] != null && conteos[m] !== '' ? parse(conteos[m]) : esperado;
    return acc + Math.abs(cent(contado - esperado));
  }, 0);
  const hayDiferencia = !!resumen && (Math.abs(cent(difEfectivo)) > 0 || difMediosCent > 0);
  // Si hay faltante/sobrante, exige justificación para poder cerrar.
  const justificacionOk = !hayDiferencia || notas.trim() !== '';

  async function confirmar() {
    if (!efectivoIngresado) { setError('Ingresá el efectivo contado en la caja antes de cerrar.'); return; }
    if (!justificacionOk) { setError('Hay una diferencia (faltante/sobrante). Justificala para poder cerrar.'); return; }
    // Candado extra: confirmación explícita mostrando el faltante/sobrante exacto,
    // para que un error de tipeo no cierre la caja sin que el cajero lo vea.
    if (hayDiferencia) {
      const tipo = difEfectivo < 0 ? 'un FALTANTE' : difEfectivo > 0 ? 'un SOBRANTE' : 'una diferencia';
      const ok = window.confirm(
        `⚠ El efectivo tiene ${tipo} de ${formatMoney(Math.abs(difEfectivo))}.\n` +
          `Esperado: ${formatMoney(efectivoEsperado)}  ·  Contado: ${formatMoney(efectivoContado)}\n\n` +
          `¿Confirmás el cierre con esta diferencia?`,
      );
      if (!ok) return;
    }
    setCerrando(true);
    setError(null);
    try {
      const conteosNum: Record<string, number> = {};
      for (const m of electronicos) if (conteos[m] != null && conteos[m] !== '') conteosNum[m] = parse(conteos[m]);
      await closeCash(sessionId, efectivoContado, conteosNum, notas || undefined);
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
                <span>Ventas</span><span>{resumen.ventas}</span>
              </div>
              <div className="arqueo__row">
                <span>Total vendido</span><span>{formatMoney(resumen.totalVendido)}</span>
              </div>
              <div className="arqueo__row arqueo__row--sub">
                <span>Fondo de apertura</span><span>{formatMoney(resumen.montoApertura)}</span>
              </div>
              {resumen.ingresos > 0 && (
                <div className="arqueo__row arqueo__row--sub">
                  <span>Ingresos de efectivo</span><span>+{formatMoney(resumen.ingresos)}</span>
                </div>
              )}
              {resumen.egresos > 0 && (
                <div className="arqueo__row arqueo__row--sub">
                  <span>Egresos de efectivo</span><span>−{formatMoney(resumen.egresos)}</span>
                </div>
              )}
            </div>

            {/* Efectivo: conteo físico */}
            <div className="concil">
              <div className="concil__head">
                <span>{label('EFECTIVO')}</span>
                <span className="muted">esperado {formatMoney(efectivoEsperado)}</span>
              </div>
              <input
                className="concil__input"
                type="number"
                inputMode="decimal"
                placeholder="Contado en caja"
                value={efectivo}
                onChange={(e) => setEfectivo(e.target.value)}
                autoFocus
              />
              <span className={`concil__dif ${difEfectivo === 0 ? '' : difEfectivo > 0 ? 'ok' : 'warn'}`}>
                {difEfectivo === 0 ? 'OK' : `${difEfectivo > 0 ? 'sobra' : 'falta'} ${formatMoney(Math.abs(difEfectivo))}`}
              </span>
            </div>

            {/* Medios electrónicos: liquidación de terminal/banco */}
            {electronicos.map((m) => {
              const esperado = resumen.porMedio[m] ?? 0;
              const contado = conteos[m] != null && conteos[m] !== '' ? parse(conteos[m]) : esperado;
              const dif = contado - esperado;
              return (
                <div className="concil" key={m}>
                  <div className="concil__head">
                    <span>{label(m)}</span>
                    <span className="muted">sistema {formatMoney(esperado)}</span>
                  </div>
                  <input
                    className="concil__input"
                    type="number"
                    inputMode="decimal"
                    placeholder={`Liquidado (${formatMoney(esperado)})`}
                    value={conteos[m] ?? ''}
                    onChange={(e) => setConteos((c) => ({ ...c, [m]: e.target.value }))}
                  />
                  <span className={`concil__dif ${dif === 0 ? '' : dif > 0 ? 'ok' : 'warn'}`}>
                    {dif === 0 ? 'OK' : `${dif > 0 ? '+' : '−'}${formatMoney(Math.abs(dif))}`}
                  </span>
                </div>
              );
            })}

            {hayDiferencia && (
              <p className="cierre-alerta">
                ⚠ Hay {difEfectivo < 0 ? 'un faltante' : 'diferencia'} en el arqueo. Justificá la diferencia para poder cerrar.
              </p>
            )}
            <label className="field">
              {hayDiferencia ? 'Justificación de la diferencia (obligatoria)' : 'Notas (opcional)'}
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder={hayDiferencia ? 'ej. error de vuelto, retiro sin registrar…' : 'observaciones del turno'}
                className={hayDiferencia && notas.trim() === '' ? 'is-required' : ''}
              />
            </label>

            {error && <p className="modal__err">{error}</p>}
          </>
        )}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={cerrando}>Cancelar</button>
          <button className="btn btn--primary" onClick={confirmar} disabled={!resumen || cerrando || !efectivoIngresado || !justificacionOk}>
            {cerrando ? 'Cerrando…' : hayDiferencia ? 'Cerrar con diferencia' : 'Cerrar caja'}
          </button>
        </div>
      </div>
    </div>
  );
}
