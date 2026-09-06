import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descuentoVigente, inicioPeriodo, montoConDescuento } from './billing.util.ts';

test('inicioPeriodo: parsea YYYY-MM (o null)', () => {
  assert.equal(inicioPeriodo('2026-09')!.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(inicioPeriodo('2026-13'), null);
  assert.equal(inicioPeriodo('malo'), null);
});

test('sin descuento → monto = precio', () => {
  assert.deepEqual(montoConDescuento(1990, {}, '2026-09'), { monto: 1990, bruto: 1990, pctAplicado: 0 });
  assert.deepEqual(montoConDescuento(1990, { descuentoPct: 0 }, '2026-09'), { monto: 1990, bruto: 1990, pctAplicado: 0 });
});

test('descuento sin vencimiento aplica siempre', () => {
  assert.equal(descuentoVigente({ descuentoPct: 50 }, '2030-01'), true);
  assert.equal(montoConDescuento(1990, { descuentoPct: 50 }, '2026-09').monto, 995);
});

test('promo Fundadores 50% con vencimiento (1 año)', () => {
  const sub = { descuentoPct: 50, descuentoHasta: new Date('2027-08-31T23:59:59Z') };
  assert.equal(descuentoVigente(sub, '2026-09'), true); // dentro
  assert.equal(descuentoVigente(sub, '2027-08'), true); // último mes
  assert.equal(descuentoVigente(sub, '2027-09'), false); // ya venció
  assert.equal(montoConDescuento(3490, sub, '2027-08').monto, 1745);
  assert.equal(montoConDescuento(3490, sub, '2027-09').monto, 3490);
});

test('clamp del porcentaje y redondeo a 2 decimales', () => {
  assert.equal(montoConDescuento(990, { descuentoPct: 150 }, '2026-09').monto, 0); // clamp 100
  assert.equal(montoConDescuento(89.9, { descuentoPct: 33 }, '2026-09').monto, 60.23);
});
