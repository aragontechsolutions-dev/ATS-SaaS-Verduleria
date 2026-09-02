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

/** Cantidad efectiva de una línea: la real si ya se pesó, si no la estimada. */
export function cantidadEfectiva(cantidad: number, cantidadReal: number | null | undefined): number {
  return cantidadReal != null ? cantidadReal : cantidad;
}

/**
 * Recalcula los subtotales y el total de un pedido usando la cantidad efectiva
 * (real tras el pesaje, o estimada). Devuelve el subtotal por línea + totales.
 */
export function recomputeOrder(
  items: Array<{ precioUnit: number; cantidad: number; cantidadReal: number | null | undefined }>,
  costoEnvio: number,
): { lineas: number[]; subtotal: number; total: number } {
  const lineas = items.map((i) => round2(i.precioUnit * cantidadEfectiva(i.cantidad, i.cantidadReal)));
  const subtotal = round2(lineas.reduce((s, x) => s + x, 0));
  return { lineas, subtotal, total: round2(subtotal + costoEnvio) };
}

/** Estados terminales: no admiten más cambios de estado. */
const ESTADOS_TERMINALES = new Set(['ENTREGADO', 'CANCELADO']);

/** ¿Se puede cambiar el estado desde `actual`? (los terminales quedan fijos). */
export function puedeCambiarEstado(actual: string): boolean {
  return !ESTADOS_TERMINALES.has(actual);
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
