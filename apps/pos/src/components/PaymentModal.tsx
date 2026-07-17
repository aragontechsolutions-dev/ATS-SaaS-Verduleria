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

/** Cobro simple de un solo medio (MVP). El multi-medio se agrega en v1. */
export function PaymentModal({ total, onConfirm, onCancel }: Props) {
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const pagoEfectivo = medio === 'EFECTIVO';
  const monto = parseFloat(recibido.replace(',', '.')) || 0;
  const vuelto = pagoEfectivo ? Math.max(0, monto - total) : 0;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
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
              />
            </label>
            <div className="modal__total">Vuelto: {formatMoney(vuelto)}</div>
          </>
        )}
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn btn--primary"
            onClick={() => onConfirm([{ medio, monto: pagoEfectivo && monto > 0 ? monto : total }])}
          >
            Confirmar venta
          </button>
        </div>
      </div>
    </div>
  );
}
