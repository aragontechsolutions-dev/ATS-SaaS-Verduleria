import { describe, expect, it } from 'vitest';
import { promoDiscount, promoLabel, promosByProduct, type Promo } from './promo';

const nxm = (llevaN: number, pagaM: number): Promo => ({ id: 'p', productId: 'x', nombre: '', tipo: 'NXM', llevaN, pagaM, precioTotal: null });
const cant = (llevaN: number, precioTotal: number): Promo => ({ id: 'p', productId: 'x', nombre: '', tipo: 'CANTIDAD', llevaN, pagaM: null, precioTotal });

describe('promoDiscount NxM', () => {
  it('2x1: por 2 unidades regala 1', () => {
    expect(promoDiscount(nxm(2, 1), 2, 100)).toBe(100);
  });
  it('2x1: por 3 unidades regala 1 (solo un grupo completo)', () => {
    expect(promoDiscount(nxm(2, 1), 3, 100)).toBe(100);
  });
  it('2x1: por 4 unidades regala 2', () => {
    expect(promoDiscount(nxm(2, 1), 4, 100)).toBe(200);
  });
  it('3x2: por 3 unidades regala 1', () => {
    expect(promoDiscount(nxm(3, 2), 3, 50)).toBe(50);
  });
  it('no aplica por debajo de N', () => {
    expect(promoDiscount(nxm(2, 1), 1, 100)).toBe(0);
  });
});

describe('promoDiscount CANTIDAD', () => {
  it('3 por $100 (precio normal 40 c/u → descuento 20)', () => {
    expect(promoDiscount(cant(3, 100), 3, 40)).toBe(20);
  });
  it('con 6 aplica dos grupos', () => {
    expect(promoDiscount(cant(3, 100), 6, 40)).toBe(40);
  });
  it('nunca da descuento negativo si la promo es más cara', () => {
    expect(promoDiscount(cant(3, 200), 3, 40)).toBe(0);
  });
});

describe('helpers', () => {
  it('promosByProduct toma la primera por producto', () => {
    const a: Promo = { ...nxm(2, 1), id: 'a', productId: 'x' };
    const b: Promo = { ...nxm(3, 2), id: 'b', productId: 'x' };
    expect(promosByProduct([a, b]).get('x')?.id).toBe('a');
  });
  it('promoLabel', () => {
    expect(promoLabel(nxm(2, 1))).toBe('2x1');
    expect(promoLabel(nxm(3, 2))).toBe('3x2');
    expect(promoLabel(cant(3, 100))).toBe('3 x $100');
  });
  it('sin promo, descuento 0', () => {
    expect(promoDiscount(null, 5, 100)).toBe(0);
  });
});
