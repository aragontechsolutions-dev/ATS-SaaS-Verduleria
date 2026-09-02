import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriasDeProductos, disponibleDeStock } from './store.helpers.ts';
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
