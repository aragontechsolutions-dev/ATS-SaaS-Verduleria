import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, descifrar, enmascarar, igualSeguro } from './crypto.ts';

const KEY = 'una-clave-de-prueba-fuerte-1234567890';

test('cifrar/descifrar hace round-trip del texto original', () => {
  const token = 'APP_USR-1234567890-abcdef';
  const enc = cifrar(token, KEY);
  assert.notEqual(enc, token);
  assert.ok(enc.startsWith('v1:'));
  assert.equal(descifrar(enc, KEY), token);
});

test('cada cifrado usa un IV distinto (no determinístico)', () => {
  assert.notEqual(cifrar('mismo', KEY), cifrar('mismo', KEY));
});

test('descifrar con otra clave falla (integridad GCM)', () => {
  const enc = cifrar('secreto', KEY);
  assert.throws(() => descifrar(enc, 'otra-clave-distinta'));
});

test('descifrar detecta manipulación del ciphertext', () => {
  const enc = cifrar('secreto', KEY);
  const partes = enc.split(':');
  const data = Buffer.from(partes[3], 'base64');
  data[0] ^= 0xff; // corrompe un byte
  partes[3] = data.toString('base64');
  assert.throws(() => descifrar(partes.join(':'), KEY));
});

test('cifrar sin clave lanza error claro', () => {
  assert.throws(() => cifrar('x', ''), /PAYMENTS_ENC_KEY/);
});

test('enmascarar muestra solo los últimos 4 caracteres', () => {
  assert.equal(enmascarar('APP_USR-123456789'), '••••••••6789');
  assert.equal(enmascarar(''), '');
});

test('igualSeguro compara correctamente', () => {
  assert.equal(igualSeguro('abc', 'abc'), true);
  assert.equal(igualSeguro('abc', 'abd'), false);
  assert.equal(igualSeguro('abc', 'abcd'), false);
});
