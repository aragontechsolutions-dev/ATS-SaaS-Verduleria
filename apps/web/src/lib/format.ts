const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', minimumFractionDigits: 2 });

export function formatMoney(n: number): string {
  return money.format(n);
}

const UNIDAD_CORTA: Record<string, string> = {
  KG: 'kg', GRAMO: 'g', UNIDAD: 'un', ATADO: 'atado', DOCENA: 'docena',
  BANDEJA: 'bandeja', CAJON: 'cajón', BOLSA: 'bolsa', BIN: 'bin', BULTO: 'bulto',
};

export function unidadCorta(u: string): string {
  return UNIDAD_CORTA[u] ?? u.toLowerCase();
}

/** true si el producto se vende por peso (cantidad = kg). */
export function esPeso(unidad: string): boolean {
  return unidad === 'KG' || unidad === 'GRAMO';
}
