import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costoUnitConMerma, margenPct, promedioPonderado } from './money.ts';

const close = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps;

test('costoUnitConMerma: sin merma es costo/rinde', () => {
  // 3 cajones * 800 = 2400, rinde 60kg → 40/kg
  assert.ok(close(costoUnitConMerma(2400, 60, 0), 40));
});

test('costoUnitConMerma: la merma infla el costo', () => {
  // 2400 / 60 / (1 - 0.06) = 42.5531...
  assert.ok(close(costoUnitConMerma(2400, 60, 0.06), 42.55319149, 1e-6));
});

test('costoUnitConMerma: clampa la merma a [0, 0.99]', () => {
  assert.ok(close(costoUnitConMerma(100, 10, -1), 10)); // merma negativa → 0
  assert.ok(close(costoUnitConMerma(100, 10, 2), costoUnitConMerma(100, 10, 0.99)));
});

test('costoUnitConMerma: rinde 0 o negativo lanza error', () => {
  assert.throws(() => costoUnitConMerma(100, 0, 0));
  assert.throws(() => costoUnitConMerma(100, -5, 0));
});

test('promedioPonderado: mezcla dos lotes', () => {
  // 60kg @ 42.5532 + 20kg @ 53.1915 = 80kg @ 45.2128
  assert.ok(close(promedioPonderado(60, 42.5532, 20, 53.1915), 45.21275, 1e-4));
});

test('promedioPonderado: stock inicial vacío devuelve el costo entrante', () => {
  assert.equal(promedioPonderado(0, 0, 20, 47.87), 47.87);
});

test('promedioPonderado: total 0 devuelve el costo entrante', () => {
  assert.equal(promedioPonderado(0, 0, 0, 12.5), 12.5);
});

test('margenPct: precio 79 costo 42.5532 ≈ 46.1%', () => {
  const m = margenPct(79, 42.5532);
  assert.ok(m != null && close(m, 46.135, 1e-2));
});

test('margenPct: precio 0 o negativo devuelve null', () => {
  assert.equal(margenPct(0, 10), null);
  assert.equal(margenPct(-5, 10), null);
});

test('margenPct: costo mayor al precio da margen negativo', () => {
  const m = margenPct(100, 120);
  assert.ok(m != null && close(m, -20));
});
