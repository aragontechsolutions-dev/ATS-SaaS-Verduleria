const money = new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  minimumFractionDigits: 2,
});

export function formatMoney(n: number): string {
  return money.format(n);
}

export function formatQty(n: number, unidad: string): string {
  const esPeso = unidad === 'KG' || unidad === 'GRAMO';
  return esPeso ? `${n.toFixed(3)} kg` : `${n} ${unidad.toLowerCase()}`;
}

// --- IVA (el precio ya viene con IVA incluido) ------------------------------

export const TASA_IVA: Record<string, number> = { EXENTO: 0, MINIMA: 0.1, BASICA: 0.22, SUSPENSO: 0 };
export const TASA_LABEL: Record<string, string> = {
  EXENTO: 'Exento', MINIMA: 'IVA 10%', BASICA: 'IVA 22%', SUSPENSO: 'Suspenso',
};

/** IVA incluido en un importe (con IVA dentro), según el indicador. */
export function ivaIncluido(totalConIva: number, indicador: string): number {
  const t = TASA_IVA[indicador] ?? 0;
  return t > 0 ? totalConIva - totalConIva / (1 + t) : 0;
}
