// ============================================================================
// Promociones del POS (2x1 / NxM y "N por un precio"). Puro y testeable.
//
// Se aplican SOLO a productos por unidad (no pesables) y sobre cantidades
// enteras. El descuento resultante se suma como descuento de la línea, así
// fluye por el total y el CFE como cualquier descuento.
// ============================================================================

export type PromoTipo = 'NXM' | 'CANTIDAD';

export interface Promo {
  id: string;
  productId: string;
  nombre: string;
  tipo: PromoTipo;
  /** Cantidad que dispara la promo (N). */
  llevaN: number;
  /** NxM: cuántas se pagan (M). */
  pagaM: number | null;
  /** CANTIDAD: precio total por llevar N. */
  precioTotal: number | null;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Primer promo aplicable por producto (mapa productId → promo). */
export function promosByProduct(promos: Promo[]): Map<string, Promo> {
  const m = new Map<string, Promo>();
  for (const p of promos) if (!m.has(p.productId)) m.set(p.productId, p);
  return m;
}

/**
 * Descuento en $ que aporta la promo para una línea (cantidad × precio). Solo
 * cuenta grupos completos de N; el resto va a precio normal.
 */
export function promoDiscount(promo: Promo | undefined | null, cantidad: number, precioUnit: number): number {
  if (!promo) return 0;
  const n = Math.floor(cantidad);
  if (n < promo.llevaN || promo.llevaN < 2) return 0;
  const grupos = Math.floor(n / promo.llevaN);

  if (promo.tipo === 'NXM' && promo.pagaM != null && promo.pagaM < promo.llevaN) {
    const gratis = grupos * (promo.llevaN - promo.pagaM);
    return round2(gratis * precioUnit);
  }
  if (promo.tipo === 'CANTIDAD' && promo.precioTotal != null) {
    const normal = grupos * promo.llevaN * precioUnit;
    const conPromo = grupos * promo.precioTotal;
    return round2(Math.max(0, normal - conPromo));
  }
  return 0;
}

/** Etiqueta corta para mostrar la promo (ej. "2x1", "3x2", "3 x $100"). */
export function promoLabel(promo: Promo): string {
  if (promo.tipo === 'NXM' && promo.pagaM != null) return `${promo.llevaN}x${promo.pagaM}`;
  if (promo.tipo === 'CANTIDAD' && promo.precioTotal != null) return `${promo.llevaN} x $${promo.precioTotal}`;
  return promo.nombre;
}
