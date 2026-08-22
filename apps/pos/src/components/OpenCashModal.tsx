import { useState } from 'react';

interface Props {
  onConfirm: (montoApertura: number) => void;
  onCancel: () => void;
  loading?: boolean;
}

/** Apertura de caja: fondo inicial de efectivo. */
export function OpenCashModal({ onConfirm, onCancel, loading }: Props) {
  const [valor, setValor] = useState('');
  const monto = parseFloat(valor.replace(',', '.')) || 0;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Abrir caja</h3>
        <p className="modal__sub">Ingresá el fondo inicial de efectivo.</p>
        <label className="field">
          Fondo de apertura ($)
          <input
            type="number"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(monto);
            }}
          />
        </label>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={() => onConfirm(monto)} disabled={loading}>
            {loading ? 'Abriendo…' : 'Abrir caja'}
          </button>
        </div>
      </div>
    </div>
  );
}
