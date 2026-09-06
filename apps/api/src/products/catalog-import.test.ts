import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarFila, normalizarNombre, parsePrecio, parsePesable, parseUnidad } from './catalog-import.ts';

test('parsePrecio: formatos uruguayos', () => {
  assert.equal(parsePrecio('89'), 89);
  assert.equal(parsePrecio('89,50'), 89.5);
  assert.equal(parsePrecio('1.234,50'), 1234.5);
  assert.equal(parsePrecio('$ 1.234,50'), 1234.5);
  assert.equal(parsePrecio('89.50'), 89.5);
  assert.equal(parsePrecio(72), 72);
  assert.equal(parsePrecio(''), null);
  assert.equal(parsePrecio('abc'), null);
  assert.equal(parsePrecio('-5'), null);
});

test('parseUnidad: sinónimos → enum', () => {
  assert.equal(parseUnidad('kg'), 'KG');
  assert.equal(parseUnidad('Kilo'), 'KG');
  assert.equal(parseUnidad('un'), 'UNIDAD');
  assert.equal(parseUnidad('atado'), 'ATADO');
  assert.equal(parseUnidad('cajón'), 'CAJON');
  assert.equal(parseUnidad('xyz'), null);
});

test('parsePesable: explícito o derivado de la unidad', () => {
  assert.equal(parsePesable('sí', null), true);
  assert.equal(parsePesable('no', 'KG'), false); // explícito gana
  assert.equal(parsePesable('', 'KG'), true); // derivado
  assert.equal(parsePesable('', 'UNIDAD'), false);
});

test('normalizarNombre: sin acentos, minúsculas', () => {
  assert.equal(normalizarNombre('  Tomate   Perita '), 'tomate perita');
  assert.equal(normalizarNombre('Morrón'), 'morron');
});

test('normalizarFila: fila válida de verdulería', () => {
  const r = normalizarFila({ nombre: 'Tomate perita', precio: '89,00', categoria: 'Verduras', unidad: 'kg' });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.fila.nombre, 'Tomate perita');
    assert.equal(r.fila.precio, 89);
    assert.equal(r.fila.unidad, 'KG');
    assert.equal(r.fila.pesable, true);
    assert.equal(r.fila.categoria, 'Verduras');
  }
});

test('normalizarFila: unidad por defecto UNIDAD, y errores', () => {
  const sinUnidad = normalizarFila({ nombre: 'Lechuga', precio: '45' });
  assert.equal(sinUnidad.ok, true);
  if (sinUnidad.ok) { assert.equal(sinUnidad.fila.unidad, 'UNIDAD'); assert.equal(sinUnidad.fila.pesable, false); }

  assert.deepEqual(normalizarFila({ nombre: 'x', precio: '10' }), { ok: false, motivo: 'Falta el nombre del producto' });
  assert.deepEqual(normalizarFila({ nombre: 'Papa', precio: 'abc' }), { ok: false, motivo: 'Precio inválido' });
  assert.deepEqual(normalizarFila({ nombre: 'Papa', precio: '10', plu: 'x' }), { ok: false, motivo: 'PLU inválido' });
});
