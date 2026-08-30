import { useMemo, useState } from 'react';
import { BILLETE_MIN, DENOMINACIONES, denomTotal, type DenomCounts } from '../lib/denominations';
import { formatMoney } from '../lib/format';

interface Props {
  /** Se llama con el total contado cada vez que cambia una cantidad. */
  onTotal: (total: number) => void;
}

/**
 * Contador de efectivo por denominación (billetes y monedas UYU). Muestra el
 * subtotal por valor y el total general. Emite el total hacia el modal contenedor.
 */
export function DenominationCounter({ onTotal }: Props) {
  const [counts, setCounts] = useState<DenomCounts>({});

  const total = useMemo(() => denomTotal(counts), [counts]);

  function set(valor: number, cantidad: number) {
    const next = { ...counts, [valor]: Math.max(0, cantidad) };
    setCounts(next);
    onTotal(denomTotal(next));
  }

  const billetes = DENOMINACIONES.filter((d) => d >= BILLETE_MIN);
  const monedas = DENOMINACIONES.filter((d) => d < BILLETE_MIN);

  const fila = (valor: number) => {
    const cant = counts[valor] || 0;
    return (
      <div className="denom__row" key={valor}>
        <span className="denom__val">{formatMoney(valor)}</span>
        <span className="denom__x">×</span>
        <input
          className="denom__input"
          type="number"
          inputMode="numeric"
          min={0}
          value={cant || ''}
          placeholder="0"
          onChange={(e) => set(valor, parseInt(e.target.value, 10) || 0)}
          onFocus={(e) => e.currentTarget.select()}
        />
        <span className="denom__sub">{cant > 0 ? formatMoney(valor * cant) : ''}</span>
      </div>
    );
  };

  return (
    <div className="denom">
      <div className="denom__group">
        <span className="denom__label">Billetes</span>
        {billetes.map(fila)}
      </div>
      <div className="denom__group">
        <span className="denom__label">Monedas</span>
        {monedas.map(fila)}
      </div>
      <div className="denom__total">
        <span>Total contado</span>
        <strong>{formatMoney(total)}</strong>
      </div>
    </div>
  );
}
