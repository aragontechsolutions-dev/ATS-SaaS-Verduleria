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
