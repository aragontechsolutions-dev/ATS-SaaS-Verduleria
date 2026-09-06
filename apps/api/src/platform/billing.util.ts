// ============================================================================
// Cálculo del monto a facturar aplicando el descuento/cupón de la suscripción.
// Puro y testeable. El descuento aplica a un período si tiene % > 0 y (no tiene
// vencimiento, o el primer día del período es <= descuentoHasta).
// ============================================================================

export interface DescuentoSub {
  descuentoPct?: number | null;
  descuentoHasta?: Date | string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Primer día (UTC) del período "YYYY-MM". */
export function inicioPeriodo(periodo: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

/** ¿Corresponde aplicar el descuento a este período? */
export function descuentoVigente(sub: DescuentoSub, periodo: string): boolean {
  const pct = sub.descuentoPct ?? 0;
  if (pct <= 0) return false;
  if (sub.descuentoHasta == null) return true;
  const ini = inicioPeriodo(periodo);
  if (!ini) return false;
  const hasta = sub.descuentoHasta instanceof Date ? sub.descuentoHasta : new Date(sub.descuentoHasta);
  return ini.getTime() <= hasta.getTime();
}

/**
 * Monto a facturar para un período dado el precio del plan y el descuento de la
 * suscripción. Devuelve el monto final, el % aplicado (0 si no) y el bruto.
 */
export function montoConDescuento(
  precioPlan: number,
  sub: DescuentoSub,
  periodo: string,
): { monto: number; bruto: number; pctAplicado: number } {
  const bruto = round2(precioPlan);
  if (!descuentoVigente(sub, periodo)) return { monto: bruto, bruto, pctAplicado: 0 };
  const pct = Math.min(100, Math.max(0, sub.descuentoPct ?? 0));
  return { monto: round2(bruto * (1 - pct / 100)), bruto, pctAplicado: pct };
}
