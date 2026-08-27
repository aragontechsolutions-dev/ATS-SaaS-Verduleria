import { useMemo, useState } from 'react';
import type { MedioPago, PosCustomer, SalePayment } from '../lib/types';
import { esEfactura } from '../lib/types';
import { formatMoney } from '../lib/format';
import { buildPayments, computeSplit, esEfectivo, round2 } from '../lib/payment';

interface Props {
  total: number;
  customer?: PosCustomer | null;
  requiereIdent?: boolean;
  onConfirm: (payments: SalePayment[], vuelto: number) => void;
  onCancel: () => void;
}

const MEDIOS: Array<{ key: MedioPago; label: string }> = [
  { key: 'EFECTIVO', label: '💵 Efectivo' },
  { key: 'DEBITO', label: '💳 Débito' },
  { key: 'CREDITO', label: '💳 Crédito' },
  { key: 'MERCADO_PAGO', label: '📱 QR / MP' },
  { key: 'TRANSFERENCIA', label: '🏦 Transfer.' },
];

const labelDe = (m: MedioPago) => MEDIOS.find((x) => x.key === m)?.label ?? m;
const parseMonto = (s: string) => parseFloat(s.replace(',', '.')) || 0;

/** Una línea de pago que el cajero arma (monto como texto para editar). */
interface LineDraft {
  medio: MedioPago;
  montoStr: string;
  referencia?: string;
}

/**
 * Cobro con PAGO MIXTO. El cajero arma una o varias líneas (efectivo + tarjeta +
 * QR…). La lógica de montos/vuelto vive en lib/payment.ts (pura y testeada).
 */
export function PaymentModal({ total, customer, requiereIdent, onConfirm, onCancel }: Props) {
  // Arranca con una línea de efectivo por el total (caso más común: 1 toque y listo).
  const [lines, setLines] = useState<LineDraft[]>([{ medio: 'EFECTIVO', montoStr: total.toFixed(2) }]);

  const parsed = useMemo(
    () => lines.map((l) => ({ medio: l.medio, monto: parseMonto(l.montoStr), referencia: l.referencia })),
    [lines],
  );
  const calc = useMemo(() => computeSplit(parsed, total), [parsed, total]);

  // Agrega una línea de un medio, prellenada con lo que falta cubrir.
  function addMedio(medio: MedioPago) {
    const falta = Math.max(0, round2(total - calc.pagado));
    setLines((ls) => [...ls, { medio, montoStr: (falta || total).toFixed(2) }]);
  }
  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  function confirmar() {
    if (!calc.puedeCobrar) return;
    const { payments, vuelto } = buildPayments(parsed, total);
    onConfirm(payments, vuelto);
  }

  const mixto = lines.length > 1;

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide">
        <h3>Cobrar {formatMoney(total)}</h3>

        {customer ? (
          <p className="pay-cust">👤 {customer.nombre}{esEfactura(customer) ? ' · e-Factura' : customer.documento ? ` · ${customer.tipoDocumento} ${customer.documento}` : ''}</p>
        ) : requiereIdent ? (
          <p className="pay-cust pay-cust--warn">⚠ Venta &gt; 5.000 UI sin comprador identificado. Cerrá y usá “Identificar comprador”.</p>
        ) : null}

        <p className="modal__sub">Agregá uno o varios medios (pago mixto).</p>
        <div className="medios">
          {MEDIOS.map((m) => (
            <button key={m.key} className="medio" onClick={() => addMedio(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="paylines">
          {lines.length === 0 && <p className="empty">Elegí un medio de pago.</p>}
          {lines.map((l, i) => (
            <div key={i} className="payline">
              <span className="payline__medio">{labelDe(l.medio)}</span>
              <input
                className="payline__monto"
                type="number"
                inputMode="decimal"
                value={l.montoStr}
                onChange={(e) => setLine(i, { montoStr: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={`Monto ${labelDe(l.medio)}`}
                autoFocus={i === 0}
                onKeyDown={(e) => { if (e.key === 'Enter' && calc.puedeCobrar) confirmar(); }}
              />
              {!esEfectivo(l.medio) && (
                <input
                  className="payline__ref"
                  value={l.referencia ?? ''}
                  onChange={(e) => setLine(i, { referencia: e.target.value })}
                  placeholder="N° / ref (opc.)"
                  aria-label="Referencia"
                />
              )}
              <button className="payline__del" onClick={() => removeLine(i)} aria-label="Quitar">✕</button>
            </div>
          ))}
        </div>

        {mixto && (
          <div className="pay-resumen">
            <span>Pagado</span>
            <strong>{formatMoney(calc.pagado)}</strong>
          </div>
        )}

        <div className={`modal__total ${!calc.puedeCobrar ? 'warn' : ''}`}>
          {calc.excedeNoEfectivo
            ? 'Los medios electrónicos superan el total (no dan vuelto)'
            : !calc.cubierto
              ? `Faltan ${formatMoney(calc.restante)}`
              : calc.vuelto > 0
                ? `Vuelto: ${formatMoney(calc.vuelto)}`
                : 'Pago exacto'}
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary" onClick={confirmar} disabled={!calc.puedeCobrar}>
            Confirmar venta
          </button>
        </div>
      </div>
    </div>
  );
}
