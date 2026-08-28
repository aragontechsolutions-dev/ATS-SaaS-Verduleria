import { useReducer } from 'react';
import type { CartItem, CatalogProduct, IvaIndicador, PosCustomer } from '../lib/types';
import { discountMoney, distribuir, round2, type DiscountSpec } from '../lib/discount';
import { promoDiscount, type Promo } from '../lib/promo';

export type PromoMap = Map<string, Promo>;

export interface CartState {
  items: CartItem[];
  /** Descuento aplicado a toda la venta; se prorratea entre las líneas. */
  globalDiscount?: DiscountSpec | null;
}

/** Ticket suspendido (venta en espera). Se guarda local, por dispositivo. */
export interface ParkedTicket {
  id: string;
  label: string;
  items: CartItem[];
  globalDiscount?: DiscountSpec | null;
  customer?: PosCustomer;
  createdAt: number;
}

type Action =
  | { type: 'add'; item: CartItem }
  | { type: 'setQty'; index: number; cantidad: number }
  | { type: 'setDescuento'; index: number; descuento: number }
  | { type: 'setGlobalDiscount'; spec: DiscountSpec | null }
  | { type: 'load'; items: CartItem[]; globalDiscount?: DiscountSpec | null }
  | { type: 'remove'; index: number }
  | { type: 'clear' };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'add': {
      // Los pesables siempre suman línea nueva (peso distinto). Los no pesables
      // se acumulan si ya existe el mismo producto.
      if (!action.item.esPesable && action.item.productId) {
        const idx = state.items.findIndex((i) => i.productId === action.item.productId && !i.esPesable);
        if (idx >= 0) {
          const items = state.items.slice();
          items[idx] = { ...items[idx], cantidad: items[idx].cantidad + action.item.cantidad };
          return { ...state, items };
        }
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case 'setQty': {
      const items = state.items.slice();
      const it = items[action.index];
      // Al cambiar la cantidad, un descuento por línea mayor al nuevo bruto se acota.
      const nuevoBruto = Math.max(0, action.cantidad) * it.precioUnit;
      const descuento = it.descuento != null ? Math.min(it.descuento, nuevoBruto) : undefined;
      items[action.index] = { ...it, cantidad: Math.max(0, action.cantidad), descuento };
      return { ...state, items: items.filter((i) => i.cantidad > 0) };
    }
    case 'setDescuento': {
      const items = state.items.slice();
      const it = items[action.index];
      const bruto = it.cantidad * it.precioUnit;
      const descuento = round2(Math.min(Math.max(0, action.descuento), bruto));
      items[action.index] = { ...it, descuento: descuento > 0 ? descuento : undefined };
      return { ...state, items };
    }
    case 'setGlobalDiscount':
      return { ...state, globalDiscount: action.spec };
    case 'load':
      return { items: action.items, globalDiscount: action.globalDiscount ?? null };
    case 'remove':
      return { ...state, items: state.items.filter((_, i) => i !== action.index) };
    case 'clear':
      return { items: [] };
    default:
      return state;
  }
}

export function cartItemFromProduct(p: CatalogProduct, cantidad: number): CartItem {
  return {
    productId: p.id,
    concepto: p.nombre,
    unidad: p.unidadVenta,
    cantidad,
    precioUnit: p.precio,
    ivaIndicador: p.ivaIndicador as IvaIndicador,
    esPesable: p.esPesable,
  };
}

/** Bruto de una línea (antes de cualquier descuento). */
export function lineBruto(item: CartItem): number {
  return item.cantidad * item.precioUnit;
}

/** Total de una línea = bruto − descuento (manual). */
export function lineTotal(item: CartItem): number {
  return lineBruto(item) - (item.descuento ?? 0);
}

/** Descuento de la línea antes del global: manual + promo (acotado al bruto). */
export function lineDescBase(item: CartItem, promos?: PromoMap): number {
  const bruto = lineBruto(item);
  const manual = item.descuento ?? 0;
  const promo =
    !item.esPesable && item.productId && promos
      ? promoDiscount(promos.get(item.productId), item.cantidad, item.precioUnit)
      : 0;
  return Math.min(bruto, round2(manual + promo));
}

/** Total de la línea tras descuentos de línea + promo (antes del global). */
function lineTotalBase(item: CartItem, promos?: PromoMap): number {
  return lineBruto(item) - lineDescBase(item, promos);
}

/** Subtotal tras descuentos por línea y promos (antes del descuento global). */
export function subtotalConLinea(items: CartItem[], promos?: PromoMap): number {
  return items.reduce((sum, it) => sum + lineTotalBase(it, promos), 0);
}

/** Importe en $ del descuento global sobre el subtotal (tras línea + promos). */
export function globalDiscountMoney(state: CartState, promos?: PromoMap): number {
  return discountMoney(subtotalConLinea(state.items, promos), state.globalDiscount);
}

/**
 * Ítems "efectivos": descuento por línea + promo + la parte prorrateada del
 * descuento global. Es lo que se muestra en el carrito y lo que se envía al
 * backend, de modo que total e IVA queden consistentes.
 */
export function effectiveItems(state: CartState, promos?: PromoMap): CartItem[] {
  const gMoney = globalDiscountMoney(state, promos);
  const bases = state.items.map((it) => lineTotalBase(it, promos));
  const shares = gMoney > 0 ? distribuir(bases, gMoney) : bases.map(() => 0);
  return state.items.map((it, i) => {
    const desc = round2(lineDescBase(it, promos) + shares[i]);
    return desc > 0 ? { ...it, descuento: desc } : { ...it, descuento: undefined };
  });
}

export interface CartTotals {
  /** Suma de los brutos (sin descuentos). */
  bruto: number;
  /** Descuento total (líneas + global). */
  descuento: number;
  /** Total a cobrar. */
  total: number;
  /** Solo el descuento global (para mostrarlo aparte). */
  globalDescuento: number;
}

export function cartTotals(state: CartState, promos?: PromoMap): CartTotals {
  const bruto = round2(state.items.reduce((s, it) => s + lineBruto(it), 0));
  const globalDescuento = globalDiscountMoney(state, promos);
  const total = round2(subtotalConLinea(state.items, promos) - globalDescuento);
  return { bruto, descuento: round2(bruto - total), total, globalDescuento };
}

export function useCart(promos?: PromoMap) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const totals = cartTotals(state, promos);
  return {
    items: state.items,
    displayItems: effectiveItems(state, promos),
    globalDiscount: state.globalDiscount ?? null,
    totals,
    total: totals.total,
    add: (item: CartItem) => dispatch({ type: 'add', item }),
    setQty: (index: number, cantidad: number) => dispatch({ type: 'setQty', index, cantidad }),
    setDescuento: (index: number, descuento: number) => dispatch({ type: 'setDescuento', index, descuento }),
    setGlobalDiscount: (spec: DiscountSpec | null) => dispatch({ type: 'setGlobalDiscount', spec }),
    load: (items: CartItem[], globalDiscount?: DiscountSpec | null) => dispatch({ type: 'load', items, globalDiscount }),
    remove: (index: number) => dispatch({ type: 'remove', index }),
    clear: () => dispatch({ type: 'clear' }),
  };
}
