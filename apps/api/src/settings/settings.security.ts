import { createHash } from 'node:crypto';

// Lógica pura de la seguridad de caja (sin NestJS): testeable con node:test.

export type CajaGate = 'discount' | 'price' | 'void' | 'return';
export const CAJA_GATES: CajaGate[] = ['discount', 'price', 'void', 'return'];
export const GATES_OFF: Record<CajaGate, boolean> = { discount: false, price: false, void: false, return: false };

/** SHA-256 de "ats:<PIN>" (idéntico al hashPin del POS, para verificar offline). */
export function hashCajaPin(pin: string): string {
  return createHash('sha256').update(`ats:${pin}`, 'utf8').digest('hex');
}

/** Normaliza el objeto de puertas a los 4 flags conocidos (descarta el resto). */
export function normalizeGates(raw: unknown): Record<CajaGate, boolean> {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = { ...GATES_OFF };
  for (const g of CAJA_GATES) out[g] = !!src[g];
  return out;
}
