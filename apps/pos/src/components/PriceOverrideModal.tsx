import { useState } from 'react';
import { formatMoney } from '../lib/format';

interface Props {
  concepto: string;
  unidad: string;
  cantidad: number;
  /** Precio unitario actual. */
  actual: number;
  onConfirm: (precioUnit: number) => void;
  onCancel: () => void;
}

/**
 * Cambio manual del precio de una línea (autorizado por PIN aguas arriba).
 * Sirve para corregir un precio mal cargado o pactar un precio puntual.
 * Queda registrado en la auditoría (PRECIO_MODIFICADO).
 */
export function PriceOverrideModal({ concepto, unidad, cantidad, actual, onConfirm, onCancel }: Props) {
  const [valor, setValor] = useState(String(actual));

  const nuevo = Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
  const valido = nuevo > 0 && Math.abs(nuevo - actual) > 0.005;
  const totalLinea = nuevo * cantidad;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Cambiar precio</h3>
        <p className="modal__sub">{concepto} — actual {formatMoney(actual)} / {unidad}</p>

        <label className="field">
          Nuevo precio por {unidad}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => { if (e.key === 'Enter' && valido) onConfirm(nuevo); }}
          />
        </label>

        <div className="disc-preview">
          <span>Total de la línea ({cantidad} {unidad})</span>
          <strong>{formatMoney(totalLinea)}</strong>
        </div>

        <div className="modal__actions modal__actions--wrap">
          <button className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onConfirm(nuevo)} disabled={!valido}>
            Aplicar precio
          </button>
        </div>
      </div>
    </div>
  );
}
