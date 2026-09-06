// ============================================================================
// Helpers puros de pagos (sin Prisma/NestJS), testeables con node:test.
// ============================================================================

export interface PagoLike {
  monto: number;
  estado: string; // PaymentEstado
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Suma de los pagos APROBADOS (los pendientes/rechazados no cuentan). */
export function sumaAprobados(pagos: PagoLike[]): number {
  return round2(pagos.filter((p) => p.estado === 'APROBADO').reduce((s, p) => s + p.monto, 0));
}

/** Saldo pendiente de un total dado lo ya pagado (nunca negativo). */
export function saldoPendiente(total: number, pagos: PagoLike[]): number {
  return round2(Math.max(0, round2(total) - sumaAprobados(pagos)));
}

/** ¿El total está cubierto por los pagos aprobados? (tolerancia de 1 centavo). */
export function estaPagado(total: number, pagos: PagoLike[]): boolean {
  return round2(total) > 0 && sumaAprobados(pagos) + 0.001 >= round2(total);
}
