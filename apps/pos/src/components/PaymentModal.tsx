import { useState } from 'react';
import type { MedioPago, SalePayment } from '../lib/types';
import { formatMoney } from '../lib/format';

interface Props {
  total: number;
  onConfirm: (payments: SalePayment[]) => void;
  onCancel: () => void;
}

const MEDIOS: Array<{ key: MedioPago; label: string }> = [
  { key: 'EFECTIVO', label: '💵 Efectivo' },
  { key: 'DEBITO', label: '💳 Débito' },
  { key: 'CREDITO', label: '💳 Crédito' },
  { key: 'MERCADO_PAGO', label: '📱 QR / MP' },
  { key: 'TRANSFERENCIA', label: '🏦 Transfer.' },
];

/** Cobro de un medio. En efectivo exige que lo recibido cubra el total. */
export function PaymentModal({ total, onConfirm, onCancel }: Props) {
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const pagoEfectivo = medio === 'EFECTIVO';
  const monto = parseFloat(recibido.replace(',', '.')) || 0;
  const vuelto = pagoEfectivo ? Math.max(0, monto - total) : 0;
  // Validación: en efectivo lo recibido debe cubrir el total.
  const insuficiente = pagoEfectivo && monto < total;
  const puedeCobrar = !pagoEfectivo || monto >= total;

  function confirmar() {
    if (!puedeCobrar) return;
    onConfirm([{ medio, monto: total }]);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide">
        <h3>Cobrar {formatMoney(total)}</h3>
        <div className="medios">
          {MEDIOS.map((m) => (
            <button
              key={m.key}
              className={`medio ${medio === m.key ? 'medio--on' : ''}`}
              onClick={() => setMedio(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {pagoEfectivo && (
          <>
            <label className="field">
              Recibido
              <input
                type="number"
                inputMode="decimal"
                value={recibido}
                onChange={(e) => setRecibido(e.target.value)}
                placeholder={String(total)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && puedeCobrar) confirmar(); }}
              />
            </label>
            <div className={`modal__total ${insuficiente ? 'warn' : ''}`}>
              {insuficiente ? `Faltan ${formatMoney(total - monto)}` : `Vuelto: ${formatMoney(vuelto)}`}
            </div>
          </>
        )}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary" onClick={confirmar} disabled={!puedeCobrar}>
            Confirmar venta
          </button>
        </div>
      </div>
    </div>
  );
}
