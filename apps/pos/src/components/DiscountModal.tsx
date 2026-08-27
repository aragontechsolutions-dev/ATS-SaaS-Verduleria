import { useState } from 'react';
import type { DiscountMode, DiscountSpec } from '../lib/discount';
import { discountMoney } from '../lib/discount';
import { formatMoney } from '../lib/format';

interface Props {
  titulo: string;
  /** Importe sobre el que se aplica el descuento (para previsualizar). */
  base: number;
  /** Descuento actual, si lo hay (para editar/quitar). */
  actual?: DiscountSpec | null;
  onConfirm: (spec: DiscountSpec | null) => void;
  onCancel: () => void;
}

/** Editor de descuento en % o en $ (línea o total). Muestra la vista previa. */
export function DiscountModal({ titulo, base, actual, onConfirm, onCancel }: Props) {
  const [mode, setMode] = useState<DiscountMode>(actual?.mode ?? 'pct');
  const [valor, setValor] = useState(actual ? String(actual.value) : '');

  const value = parseFloat(valor.replace(',', '.')) || 0;
  const spec: DiscountSpec = { mode, value };
  const money = discountMoney(base, spec);
  const restante = Math.max(0, base - money);
  const valido = value > 0 && money > 0;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{titulo}</h3>
        <p className="modal__sub">Sobre {formatMoney(base)}</p>

        <div className="disc-modes">
          <button className={`disc-mode ${mode === 'pct' ? 'is-on' : ''}`} onClick={() => setMode('pct')}>%</button>
          <button className={`disc-mode ${mode === 'amount' ? 'is-on' : ''}`} onClick={() => setMode('amount')}>$</button>
        </div>

        <label className="field">
          {mode === 'pct' ? 'Porcentaje de descuento' : 'Importe de descuento'}
          <input
            type="number"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={mode === 'pct' ? '10' : '100'}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && valido) onConfirm(spec); }}
          />
        </label>

        <div className="disc-preview">
          <span>Descuento</span>
          <strong>−{formatMoney(money)}</strong>
          <span className="disc-preview__rest">Queda {formatMoney(restante)}</span>
        </div>

        <div className="modal__actions modal__actions--wrap">
          {actual && (
            <button className="btn btn--ghost" onClick={() => onConfirm(null)}>Quitar descuento</button>
          )}
          <button className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onConfirm(spec)} disabled={!valido}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
