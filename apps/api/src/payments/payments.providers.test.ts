import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVEEDORES, esProveedorIntegrado, proveedorPorKey } from './payments.providers.ts';

test('hay proveedores en el catálogo y todos tienen color hex válido', () => {
  assert.ok(PROVEEDORES.length >= 2);
  for (const p of PROVEEDORES) {
    assert.match(p.color, /^#[0-9a-fA-F]{6}$/, `color inválido en ${p.key}`);
    assert.equal(typeof p.integrado, 'boolean');
  }
});

test('Mercado Pago está integrado (online + presencial)', () => {
  const mp = proveedorPorKey('MERCADO_PAGO');
  assert.ok(mp);
  assert.equal(mp!.integrado, true);
  assert.equal(mp!.online, true);
  assert.equal(mp!.presencial, true);
  assert.equal(esProveedorIntegrado('MERCADO_PAGO'), true);
});

test('los demás quedan como no integrados por ahora', () => {
  assert.equal(esProveedorIntegrado('FISERV'), false);
  assert.equal(esProveedorIntegrado('HANDY'), false);
  assert.equal(esProveedorIntegrado('DESCONOCIDO'), false);
});
