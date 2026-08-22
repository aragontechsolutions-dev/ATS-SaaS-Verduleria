import { useReducer } from 'react';
import type { CartItem, CatalogProduct, IvaIndicador } from '../lib/types';

export interface CartState {
  items: CartItem[];
}

type Action =
  | { type: 'add'; item: CartItem }
  | { type: 'setQty'; index: number; cantidad: number }
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
          return { items };
        }
      }
      return { items: [...state.items, action.item] };
    }
    case 'setQty': {
      const items = state.items.slice();
      items[action.index] = { ...items[action.index], cantidad: Math.max(0, action.cantidad) };
      return { items: items.filter((i) => i.cantidad > 0) };
    }
    case 'remove':
      return { items: state.items.filter((_, i) => i !== action.index) };
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

export function lineTotal(item: CartItem): number {
  return item.cantidad * item.precioUnit - (item.descuento ?? 0);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, it) => sum + lineTotal(it), 0);
}

export function useCart() {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  return {
    items: state.items,
    total: cartTotal(state.items),
    add: (item: CartItem) => dispatch({ type: 'add', item }),
    setQty: (index: number, cantidad: number) => dispatch({ type: 'setQty', index, cantidad }),
    remove: (index: number) => dispatch({ type: 'remove', index }),
    clear: () => dispatch({ type: 'clear' }),
  };
}
