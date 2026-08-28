import { useState } from 'react';
import type { CartItem, PosCustomer } from '../lib/types';
import { esEfactura } from '../lib/types';
import { lineBruto, lineTotal, type CartTotals, type PromoMap } from '../state/cart';
import { promoLabel } from '../lib/promo';
import { formatMoney, formatQty, ivaIncluido, TASA_LABEL } from '../lib/format';

interface Props {
  items: CartItem[];
  totals: CartTotals;
  promos?: PromoMap;
  hayGlobalDiscount?: boolean;
  sinCaja?: boolean;
  customer?: PosCustomer | null;
  requiereIdent?: boolean;
  onIdentify?: () => void;
  onClearCustomer?: () => void;
  onSetQty: (index: number, cantidad: number) => void;
  onLineDiscount?: (index: number) => void;
  onGlobalDiscount?: () => void;
  onSuspend?: () => void;
  onOpenParked?: () => void;
  parkedCount?: number;
  onRemove: (index: number) => void;
  onClear: () => void;
  onCheckout: () => void;
  onAbrirCaja?: () => void;
}

export function Cart({
  items,
  totals,
  promos,
  hayGlobalDiscount,
  sinCaja,
  customer,
  requiereIdent,
  onIdentify,
  onClearCustomer,
  onSetQty,
  onLineDiscount,
  onGlobalDiscount,
  onSuspend,
  onOpenParked,
  parkedCount = 0,
  onRemove,
  onClear,
  onCheckout,
  onAbrirCaja,
}: Props) {
  // En móvil el carrito es una hoja inferior colapsable; en escritorio, panel fijo.
  const [expanded, setExpanded] = useState(false);
  const count = items.reduce((n, it) => n + (it.esPesable ? 1 : it.cantidad), 0);
  const hayDescuento = totals.descuento > 0;

  return (
    <aside className={`cart ${expanded ? 'cart--expanded' : ''}`}>
      <button className="cart__handle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <span className="cart__handle-info">🛒 {items.length} {items.length === 1 ? 'ítem' : 'ítems'}{count !== items.length ? ` · ${count} u.` : ''}</span>
        <span className="cart__handle-total">{formatMoney(totals.total)}</span>
        <span className="cart__handle-chevron">{expanded ? '▾' : '▴'}</span>
      </button>
      <div className="cart__list">
        {items.length === 0 && <p className="empty">Carrito vacío. Escaneá o tocá un producto.</p>}
        {items.map((it, i) => {
          const iva = ivaIncluido(lineTotal(it), it.ivaIndicador);
          const desc = it.descuento ?? 0;
          return (
            <div key={i} className="cart__item">
              <div className="cart__info">
                <span className="cart__name">{it.concepto}</span>
                <span className="cart__sub">
                  {formatQty(it.cantidad, it.unidad)} × {formatMoney(it.precioUnit)}
                </span>
                <span className="cart__iva">
                  {TASA_LABEL[it.ivaIndicador] ?? it.ivaIndicador}
                  {iva > 0 && ` · ${formatMoney(iva)}`}
                  {desc > 0 && <span className="cart__desc"> · −{formatMoney(desc)}</span>}
                  {(() => {
                    const promo = !it.esPesable && it.productId ? promos?.get(it.productId) : undefined;
                    return promo && it.cantidad >= promo.llevaN
                      ? <span className="cart__promo">{promoLabel(promo)}</span>
                      : null;
                  })()}
                </span>
              </div>
              <div className="cart__qty">
                {!it.esPesable && (
                  <>
                    <button onClick={() => onSetQty(i, it.cantidad - 1)} aria-label="Menos">−</button>
                    <input
                      className="cart__qtyinput"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={it.cantidad}
                      onChange={(e) => onSetQty(i, Math.max(0, parseInt(e.target.value, 10) || 0))}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Cantidad"
                    />
                    <button onClick={() => onSetQty(i, it.cantidad + 1)} aria-label="Más">+</button>
                  </>
                )}
              </div>
              <span className="cart__total">
                {desc > 0 && <s className="cart__was">{formatMoney(lineBruto(it))}</s>}
                {formatMoney(lineTotal(it))}
              </span>
              <div className="cart__lineactions">
                {onLineDiscount && (
                  <button className="cart__disc" onClick={() => onLineDiscount(i)} aria-label="Descuento" title="Descuento de línea">🏷</button>
                )}
                <button className="cart__del" onClick={() => onRemove(i)} aria-label="Quitar">✕</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cart__footer">
        {onIdentify && (
          customer ? (
            <div className="cust-chip">
              <span className="cust-chip__info">
                👤 {customer.nombre}
                {esEfactura(customer)
                  ? <span className="cust-chip__tag">e-Factura</span>
                  : customer.documento && <span className="cust-chip__doc">{customer.tipoDocumento} {customer.documento}</span>}
              </span>
              <button className="cust-chip__x" onClick={onClearCustomer} aria-label="Quitar comprador">✕</button>
            </div>
          ) : (
            <button className={`cust-add ${requiereIdent ? 'cust-add--req' : ''}`} onClick={onIdentify}>
              {requiereIdent ? '⚠ Identificar comprador (> 5.000 UI)' : '👤 Identificar comprador (opcional)'}
            </button>
          )
        )}
        {sinCaja && (
          <div className="cart__cajahint">
            🔒 Abrí la caja para poder cobrar.
            {onAbrirCaja && <button className="btn btn--sm btn--accent" onClick={onAbrirCaja}>Abrir caja</button>}
          </div>
        )}
        {(onSuspend || onOpenParked) && (
          <div className="cart__hold">
            {onSuspend && (
              <button className="btn btn--ghost btn--sm" onClick={onSuspend} disabled={items.length === 0}>
                ⏸ Suspender
              </button>
            )}
            {onOpenParked && (
              <button className="btn btn--ghost btn--sm" onClick={onOpenParked} disabled={parkedCount === 0}>
                ⏳ En espera{parkedCount > 0 ? ` (${parkedCount})` : ''}
              </button>
            )}
          </div>
        )}
        {onGlobalDiscount && items.length > 0 && (
          <button className={`cart__globaldisc ${hayGlobalDiscount ? 'is-on' : ''}`} onClick={onGlobalDiscount}>
            🏷 {hayGlobalDiscount ? 'Editar descuento total' : 'Descuento total'}
          </button>
        )}
        {hayDescuento && (
          <div className="cart__totrow">
            <span>Subtotal</span>
            <span>{formatMoney(totals.bruto)}</span>
          </div>
        )}
        {hayDescuento && (
          <div className="cart__totrow cart__totrow--desc">
            <span>Descuento</span>
            <span>−{formatMoney(totals.descuento)}</span>
          </div>
        )}
        <div className="cart__grandtotal">
          <span>Total</span>
          <strong>{formatMoney(totals.total)}</strong>
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
