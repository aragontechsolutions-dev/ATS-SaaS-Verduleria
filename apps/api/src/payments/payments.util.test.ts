import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estaPagado, saldoPendiente, sumaAprobados } from './payments.util.ts';

const pagos = [
  { monto: 100, estado: 'APROBADO' },
  { monto: 50, estado: 'APROBADO' },
  { monto: 30, estado: 'PENDIENTE' }, // no cuenta
  { monto: 20, estado: 'RECHAZADO' }, // no cuenta
];

test('sumaAprobados: solo cuenta los APROBADOS', () => {
  assert.equal(sumaAprobados(pagos), 150);
  assert.equal(sumaAprobados([]), 0);
});

test('saldoPendiente: total - aprobado, nunca negativo', () => {
  assert.equal(saldoPendiente(200, pagos), 50);
  assert.equal(saldoPendiente(150, pagos), 0);
  assert.equal(saldoPendiente(100, pagos), 0); // sobrepago no da negativo
});

test('estaPagado: cubierto con tolerancia de centavo', () => {
  assert.equal(estaPagado(150, pagos), true);
  assert.equal(estaPagado(151, pagos), false);
  assert.equal(estaPagado(0, []), false); // total 0 no está "pagado"
  assert.equal(estaPagado(149.999, pagos), true);
});
