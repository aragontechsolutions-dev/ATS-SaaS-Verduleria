import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcLine, categoriasDeProductos, disponibleDeStock, randomCodigo, round2 } from './store.helpers.ts';
import type { StoreProduct } from './store.service.ts';

test('disponibleDeStock: sin filas → disponible (no controlado)', () => {
  assert.equal(disponibleDeStock([]), true);
});

test('disponibleDeStock: stock > 0 → disponible', () => {
  assert.equal(disponibleDeStock([{ cantidad: 3 }, { cantidad: 1.5 }]), true);
});

test('disponibleDeStock: total 0 o negativo → no disponible', () => {
  assert.equal(disponibleDeStock([{ cantidad: 0 }]), false);
  assert.equal(disponibleDeStock([{ cantidad: 2 }, { cantidad: -2 }]), false);
});

test('disponibleDeStock: convierte Decimals/strings a número', () => {
  assert.equal(disponibleDeStock([{ cantidad: '0.500' }]), true);
});

function prod(over: Partial<StoreProduct>): StoreProduct {
  return {
    id: 'p', nombre: 'X', descripcionOnline: null, categoriaId: null, categoriaNombre: null,
    unidadVenta: 'KG', esPesable: true, precio: 0, imagenUrl: null, disponible: true, ...over,
  };
}

test('categoriasDeProductos: deduplica y ordena por nombre (es)', () => {
  const items = [
    prod({ categoriaId: 'b', categoriaNombre: 'Verduras' }),
    prod({ categoriaId: 'a', categoriaNombre: 'Frutas' }),
    prod({ categoriaId: 'b', categoriaNombre: 'Verduras' }),
  ];
  assert.deepEqual(categoriasDeProductos(items), [
    { id: 'a', nombre: 'Frutas' },
    { id: 'b', nombre: 'Verduras' },
  ]);
});

test('categoriasDeProductos: ignora productos sin categoría', () => {
  assert.deepEqual(categoriasDeProductos([prod({ categoriaId: null, categoriaNombre: null })]), []);
});

test('round2: redondea a 2 decimales sin errores de flotante', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(19.99 * 1.5), 29.99);
});

test('calcLine: recalcula el subtotal con el precio del catálogo', () => {
  const p = { id: 'x', nombre: 'Tomate', unidadVenta: 'KG', esPesable: true, precio: 89.9 };
  const l = calcLine(p, 1.5);
  assert.equal(l.productId, 'x');
  assert.equal(l.concepto, 'Tomate');
  assert.equal(l.esPesable, true);
  assert.equal(l.precioUnit, 89.9);
  assert.equal(l.subtotal, round2(89.9 * 1.5));
});

test('randomCodigo: 8 caracteres sin I/L/O/0/1', () => {
  for (let i = 0; i < 50; i++) {
    const c = randomCodigo();
    assert.equal(c.length, 8);
    assert.match(c, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    assert.doesNotMatch(c, /[ILO01]/);
  }
});
