// ============================================================================
// Descuentos: por línea y por total (en % o en $). Puro y testeable.
//
// El backend solo tiene descuento POR ÍTEM (no un descuento de venta), así que
// un descuento global se PRORRATEA entre las líneas proporcionalmente a su
// importe. Así el total y el IVA por tasa quedan correctos sin cambiar el modelo.
// ============================================================================

export type DiscountMode = 'pct' | 'amount';

export interface DiscountSpec {
  mode: DiscountMode;
  /** Porcentaje (0–100) si mode='pct'; importe en $ si mode='amount'. */
  value: number;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Convierte un descuento (%, $) a importe en $, acotado a [0, base]. */
export function discountMoney(base: number, spec: DiscountSpec | null | undefined): number {
  if (!spec || !(spec.value > 0) || base <= 0) return 0;
  const money = spec.mode === 'pct' ? (base * spec.value) / 100 : spec.value;
  return round2(Math.min(Math.max(0, money), base));
}

/**
 * Reparte `total` de descuento entre `bases` proporcionalmente. La suma de lo
 * repartido es exactamente min(total, Σbases); el remanente por redondeo se
 * ajusta en la última línea con base > 0.
 */
export function distribuir(bases: number[], total: number): number[] {
  const suma = bases.reduce((a, b) => a + b, 0);
  if (suma <= 0 || total <= 0) return bases.map(() => 0);
  const desc = Math.min(total, suma);
  const shares = bases.map((b) => round2((desc * b) / suma));
  const diff = round2(desc - shares.reduce((a, b) => a + b, 0));
  if (diff !== 0) {
    for (let i = bases.length - 1; i >= 0; i--) {
      if (bases[i] > 0) {
        shares[i] = round2(shares[i] + diff);
        break;
      }
    }
  }
  return shares;
}
