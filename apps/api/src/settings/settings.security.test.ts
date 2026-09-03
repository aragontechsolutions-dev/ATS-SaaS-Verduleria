import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashCajaPin, normalizeGates } from './settings.security.ts';

test('hashCajaPin: SHA-256 de "ats:<pin>" (idéntico al POS)', () => {
  // Debe coincidir con hashPin() del POS (crypto.subtle SHA-256 de "ats:1234").
  assert.equal(hashCajaPin('1234'), '8f713e8649620b98bcbf1d4a1fb117c696c9ac61f3cefbd18b4385d1411de911');
  assert.equal(hashCajaPin('1234').length, 64);
});

test('hashCajaPin: es determinista y depende del PIN', () => {
  assert.equal(hashCajaPin('9999'), hashCajaPin('9999'));
  assert.notEqual(hashCajaPin('1111'), hashCajaPin('2222'));
});

test('normalizeGates: fuerza los 4 flags conocidos y descarta el resto', () => {
  assert.deepEqual(normalizeGates({ discount: true, hack: true }), {
    discount: true, price: false, void: false, return: false,
  });
  assert.deepEqual(normalizeGates(null), { discount: false, price: false, void: false, return: false });
  assert.deepEqual(normalizeGates({ price: 1, return: 'x' }), {
    discount: false, price: true, void: false, return: true,
  });
});
