// Lógica pura de la tienda online (testeable sin base de datos).

import type { StoreCategory, StoreProduct } from './store.service';

/**
 * ¿Hay stock para pedir? Un producto SIN filas de stock no está controlado y se
 * considera siempre disponible; con filas, disponible si la suma es > 0.
 */
export function disponibleDeStock(stockRows: Array<{ cantidad: unknown }>): boolean {
  if (!stockRows.length) return true;
  return stockRows.reduce((s, x) => s + Number(x.cantidad), 0) > 0;
}

/**
 * Deriva las categorías presentes en un catálogo online, sin duplicados y
 * ordenadas por nombre (es-UY). Ignora productos sin categoría.
 */
export function categoriasDeProductos(items: StoreProduct[]): StoreCategory[] {
  const catMap = new Map<string, string>();
  for (const p of items) {
    if (p.categoriaId && p.categoriaNombre && !catMap.has(p.categoriaId)) {
      catMap.set(p.categoriaId, p.categoriaNombre);
    }
  }
  return [...catMap.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Código público de seguimiento: 8 caracteres alfanuméricos sin ambigüedades. */
export function randomCodigo(): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin I/L/O/0/1
  let out = '';
  for (let i = 0; i < 8; i++) out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return out;
}

export interface OrderLineCalc {
  productId: string;
  concepto: string;
  unidad: string;
  esPesable: boolean;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
}

/** Redondea a 2 decimales (dinero). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el subtotal de una línea de pedido a partir del precio del catálogo
 * (el servidor NUNCA confía en el precio que manda el cliente).
 */
export function calcLine(
  p: { id: string; nombre: string; unidadVenta: string; esPesable: boolean; precio: number },
  cantidad: number,
): OrderLineCalc {
  return {
    productId: p.id,
    concepto: p.nombre,
    unidad: p.unidadVenta,
    esPesable: p.esPesable,
    cantidad,
    precioUnit: p.precio,
    subtotal: round2(p.precio * cantidad),
  };
}
