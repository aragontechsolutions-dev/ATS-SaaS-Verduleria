import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esTelefonoUyValido, normalizarTelefonoUy } from './telefono.ts';

test('móvil con 0 inicial: 09X XXX XXX → +5989XXXXXXX', () => {
  assert.equal(normalizarTelefonoUy('099123456'), '+59899123456');
  assert.equal(normalizarTelefonoUy('091234567'), '+59891234567');
});

test('tolera espacios, guiones y paréntesis', () => {
  assert.equal(normalizarTelefonoUy('099 123 456'), '+59899123456');
  assert.equal(normalizarTelefonoUy('099-123-456'), '+59899123456');
  assert.equal(normalizarTelefonoUy('(099) 123 456'), '+59899123456');
});

test('sin 0 inicial (8 dígitos) → +598', () => {
  assert.equal(normalizarTelefonoUy('99123456'), '+59899123456');
});

test('ya internacional: +598 / 598 / 00598', () => {
  assert.equal(normalizarTelefonoUy('+598 99 123 456'), '+59899123456');
  assert.equal(normalizarTelefonoUy('59899123456'), '+59899123456');
  assert.equal(normalizarTelefonoUy('0059899123456'), '+59899123456');
});

test('fijo (Maldonado 42XXXXXX) también normaliza', () => {
  assert.equal(normalizarTelefonoUy('42234567'), '+59842234567');
  assert.equal(normalizarTelefonoUy('042 234 567'), '+59842234567');
});

test('inválidos → null', () => {
  assert.equal(normalizarTelefonoUy(''), null);
  assert.equal(normalizarTelefonoUy('123'), null); // muy corto
  assert.equal(normalizarTelefonoUy('9912345'), null); // 7 dígitos
  assert.equal(normalizarTelefonoUy('991234567'), null); // 9 dígitos (sin 0)
  assert.equal(normalizarTelefonoUy(null), null);
});

test('esTelefonoUyValido', () => {
  assert.equal(esTelefonoUyValido('099123456'), true);
  assert.equal(esTelefonoUyValido('abc'), false);
});
