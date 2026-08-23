import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTempPassword } from './password.util.ts';

test('generateTempPassword: longitud por defecto 16', () => {
  assert.equal(generateTempPassword().length, 16);
});

test('generateTempPassword: respeta la longitud pedida', () => {
  assert.equal(generateTempPassword(24).length, 24);
});

test('generateTempPassword: incluye minúscula, mayúscula y dígito', () => {
  for (let i = 0; i < 50; i++) {
    const p = generateTempPassword();
    assert.match(p, /[a-z]/, `sin minúscula: ${p}`);
    assert.match(p, /[A-Z]/, `sin mayúscula: ${p}`);
    assert.match(p, /[2-9]/, `sin dígito: ${p}`);
  }
});

test('generateTempPassword: sin caracteres ambiguos (0 O 1 l I)', () => {
  for (let i = 0; i < 50; i++) {
    assert.doesNotMatch(generateTempPassword(), /[0O1lI]/);
  }
});

test('generateTempPassword: dos llamadas no coinciden (entropía)', () => {
  assert.notEqual(generateTempPassword(), generateTempPassword());
});
