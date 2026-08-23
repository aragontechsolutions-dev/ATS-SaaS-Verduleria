/**
 * Funciones puras de cálculo monetario del dominio (costos, promedios, margen).
 * Aisladas acá para poder testearlas sin base de datos.
 */

/**
 * Costo por unidad de venta a partir del costo total de la línea de compra, el
 * rinde recibido (en unidad de venta) y la merma estimada del producto. La
 * merma infla el costo porque reduce lo vendible: costo / rinde / (1 − merma).
 */
export function costoUnitConMerma(costoLinea: number, rinde: number, mermaPct: number): number {
  if (rinde <= 0) throw new Error('El rinde debe ser mayor a 0');
  const merma = Math.min(0.99, Math.max(0, mermaPct));
  return costoLinea / rinde / (1 - merma);
}

/**
 * Promedio ponderado del costo al incorporar una cantidad nueva a un stock
 * existente. Si no queda cantidad total, devuelve el costo entrante.
 */
export function promedioPonderado(prevQty: number, prevCost: number, addQty: number, addCost: number): number {
  const total = prevQty + addQty;
  if (total <= 0) return addCost;
  return (prevQty * prevCost + addQty * addCost) / total;
}

/** Margen porcentual sobre el precio de venta. `null` si no es computable. */
export function margenPct(precio: number, costo: number): number | null {
  if (precio <= 0) return null;
  return ((precio - costo) / precio) * 100;
}
