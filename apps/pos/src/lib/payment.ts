// ============================================================================
// Lógica de PAGO MIXTO (varios medios en una venta). Pura y testeable.
//
// Convención (alineada con el arqueo del backend): los `payments` enviados
// suman EXACTO el total (montos APLICADOS). El efectivo aplicado = total − los
// medios electrónicos; el efectivo que el cajero ingresa de más es VUELTO y va
// aparte (no se registra como pago, para no inflar el efectivo esperado en caja).
//
// Reglas:
//  - Los medios electrónicos (tarjeta, QR, transfer.) no dan vuelto: su suma no
//    puede superar el total.
//  - El efectivo cubre el resto; si se ingresa de más, se calcula el vuelto.
// ============================================================================

import type { MedioPago, SalePayment } from './types';

export interface PaymentLine {
  medio: MedioPago;
  monto: number;
  referencia?: string;
}

export interface SplitResult {
  /** Suma de medios electrónicos (aplicada tal cual). */
  noEfectivo: number;
  /** Efectivo que ingresó el cajero (puede superar lo necesario). */
  efectivoIngresado: number;
  /** Efectivo que queda en caja (total − electrónicos). */
  efectivoAplicado: number;
  /** Total pagado (electrónicos + efectivo ingresado). */
  pagado: number;
  /** Cuánto falta para cubrir el total (0 si ya está cubierto). */
  restante: number;
  /** Vuelto a entregar en efectivo. */
  vuelto: number;
  /** true si los medios electrónicos superan el total (inválido). */
  excedeNoEfectivo: boolean;
  /** true si el total está cubierto. */
  cubierto: boolean;
  /** true si se puede cobrar (cubierto y sin exceso electrónico). */
  puedeCobrar: boolean;
}

export const EPS = 0.005;
export const esEfectivo = (m: MedioPago): boolean => m === 'EFECTIVO';
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Calcula el estado de un pago mixto a partir de las líneas y el total. */
export function computeSplit(lines: PaymentLine[], total: number): SplitResult {
  let noEfectivo = 0;
  let efectivoIngresado = 0;
  for (const l of lines) {
    const m = Number.isFinite(l.monto) ? l.monto : 0;
    if (esEfectivo(l.medio)) efectivoIngresado += m;
    else noEfectivo += m;
  }
  noEfectivo = round2(noEfectivo);
  efectivoIngresado = round2(efectivoIngresado);
  const efectivoAplicado = round2(Math.max(0, total - noEfectivo));
  const pagado = round2(noEfectivo + efectivoIngresado);
  const restante = round2(Math.max(0, total - pagado));
  const vuelto = round2(Math.max(0, efectivoIngresado - efectivoAplicado));
  const excedeNoEfectivo = noEfectivo > total + EPS;
  const cubierto = pagado >= total - EPS;
  return {
    noEfectivo,
    efectivoIngresado,
    efectivoAplicado,
    pagado,
    restante,
    vuelto,
    excedeNoEfectivo,
    cubierto,
    puedeCobrar: cubierto && !excedeNoEfectivo,
  };
}

/**
 * Construye los `payments` a enviar (montos aplicados, suman el total) y el
 * vuelto. Los medios electrónicos van tal cual; el efectivo, aplicado.
 */
export function buildPayments(
  lines: PaymentLine[],
  total: number,
): { payments: SalePayment[]; vuelto: number } {
  const split = computeSplit(lines, total);
  const payments: SalePayment[] = [];
  for (const l of lines) {
    if (esEfectivo(l.medio)) continue;
    const monto = round2(l.monto);
    if (monto > EPS) {
      payments.push({ medio: l.medio, monto, referencia: l.referencia?.trim() || undefined });
    }
  }
  if (split.efectivoAplicado > EPS) {
    payments.push({ medio: 'EFECTIVO', monto: split.efectivoAplicado });
  }
  return { payments, vuelto: split.vuelto };
}
