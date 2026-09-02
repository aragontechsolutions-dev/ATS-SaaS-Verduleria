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
