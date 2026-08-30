// Conteo de efectivo por denominación (pesos uruguayos). Sirve como ayuda para
// armar el fondo de apertura y para el arqueo de cierre: el cajero cuenta cuántos
// billetes/monedas de cada valor hay y el sistema calcula el total, evitando
// errores de tipeo. Es una ayuda de cálculo local; no cambia el modelo de datos.

/** Denominaciones de curso legal en Uruguay, de mayor a menor. */
export const DENOMINACIONES: number[] = [2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

/** Umbral (inclusive) a partir del cual una denominación es billete; debajo, moneda. */
export const BILLETE_MIN = 20;

export type DenomCounts = Record<number, number>;

/** Total en $ del conteo por denominación. */
export function denomTotal(counts: DenomCounts): number {
  return DENOMINACIONES.reduce((sum, valor) => sum + valor * (counts[valor] || 0), 0);
}
