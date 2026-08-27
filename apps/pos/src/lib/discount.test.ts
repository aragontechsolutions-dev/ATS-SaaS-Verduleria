import { describe, expect, it } from 'vitest';
import { discountMoney, distribuir } from './discount';

describe('discountMoney', () => {
  it('porcentaje sobre la base', () => {
    expect(discountMoney(1000, { mode: 'pct', value: 10 })).toBe(100);
  });
  it('importe fijo', () => {
    expect(discountMoney(1000, { mode: 'amount', value: 150 })).toBe(150);
  });
  it('nunca supera la base', () => {
    expect(discountMoney(100, { mode: 'amount', value: 500 })).toBe(100);
    expect(discountMoney(100, { mode: 'pct', value: 150 })).toBe(100);
  });
  it('descarta valores no positivos', () => {
    expect(discountMoney(100, { mode: 'pct', value: 0 })).toBe(0);
    expect(discountMoney(100, null)).toBe(0);
  });
});

describe('distribuir', () => {
  it('reparte proporcional al importe de cada línea', () => {
    const r = distribuir([600, 400], 100);
    expect(r).toEqual([60, 40]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('la suma repartida es exacta (ajusta redondeo)', () => {
    const r = distribuir([33.33, 33.33, 33.34], 10);
    expect(round2sum(r)).toBe(10);
  });
  it('acota el descuento a la suma de bases', () => {
    const r = distribuir([50, 50], 500);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('sin bases o sin descuento, devuelve ceros', () => {
    expect(distribuir([0, 0], 50)).toEqual([0, 0]);
    expect(distribuir([100, 100], 0)).toEqual([0, 0]);
  });
});

function round2sum(xs: number[]): number {
  return Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
}
