import { describe, expect, it } from 'vitest';
import { DENOMINACIONES, denomTotal } from './denominations';

describe('denomTotal', () => {
  it('suma cero sin conteo', () => {
    expect(denomTotal({})).toBe(0);
  });

  it('multiplica valor por cantidad y suma', () => {
    // 3×1000 + 5×500 + 2×100 = 5700
    expect(denomTotal({ 1000: 3, 500: 5, 100: 2 })).toBe(5700);
  });

  it('incluye monedas', () => {
    // 4×50 + 3×10 + 7×1 = 237
    expect(denomTotal({ 50: 4, 10: 3, 1: 7 })).toBe(237);
  });

  it('ignora denominaciones ausentes o en cero', () => {
    expect(denomTotal({ 2000: 1, 5: 0 })).toBe(2000);
  });

  it('cubre todas las denominaciones vigentes', () => {
    const counts = Object.fromEntries(DENOMINACIONES.map((d) => [d, 1]));
    expect(denomTotal(counts)).toBe(DENOMINACIONES.reduce((a, b) => a + b, 0));
  });
});
