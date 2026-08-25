import type { CartItem } from '../lib/types';
import { lineTotal } from '../state/cart';
import { formatMoney, formatQty } from '../lib/format';

interface Props {
  items: CartItem[];
  total: number;
  sinCaja?: boolean;
  onSetQty: (index: number, cantidad: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onCheckout: () => void;
  onAbrirCaja?: () => void;
}

export function Cart({ items, total, sinCaja, onSetQty, onRemove, onClear, onCheckout, onAbrirCaja }: Props) {
  return (
    <aside className="cart">
      <div className="cart__list">
        {items.length === 0 && <p className="empty">Carrito vacío. Escaneá o tocá un producto.</p>}
        {items.map((it, i) => (
          <div key={i} className="cart__item">
            <div className="cart__info">
              <span className="cart__name">{it.concepto}</span>
              <span className="cart__sub">
                {formatQty(it.cantidad, it.unidad)} × {formatMoney(it.precioUnit)}
              </span>
            </div>
            <div className="cart__qty">
              {!it.esPesable && (
                <>
                  <button onClick={() => onSetQty(i, it.cantidad - 1)}>−</button>
                  <span>{it.cantidad}</span>
                  <button onClick={() => onSetQty(i, it.cantidad + 1)}>+</button>
                </>
              )}
            </div>
            <span className="cart__total">{formatMoney(lineTotal(it))}</span>
            <button className="cart__del" onClick={() => onRemove(i)} aria-label="Quitar">
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="cart__footer">
        {sinCaja && (
          <div className="cart__cajahint">
            🔒 Abrí la caja para poder cobrar.
            {onAbrirCaja && <button className="btn btn--sm btn--accent" onClick={onAbrirCaja}>Abrir caja</button>}
          </div>
        )}
        <div className="cart__grandtotal">
          <span>Total</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div className="cart__actions">
          <button className="btn btn--ghost" onClick={onClear} disabled={items.length === 0}>
            Vaciar
          </button>
          <button className="btn btn--accent" onClick={onCheckout} disabled={items.length === 0 || sinCaja}>
            Cobrar
          </button>
        </div>
      </div>
    </aside>
  );
}
