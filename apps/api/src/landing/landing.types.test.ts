import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultLanding, normalizeLanding } from './landing.types.ts';

test('defaultLanding usa el nombre de la verdulería en el hero', () => {
  const c = defaultLanding('Verdulería La Esquina', 'Roosevelt 1234');
  assert.equal(c.hero.titulo, 'Verdulería La Esquina');
  assert.equal(c.horarios.direccion, 'Roosevelt 1234');
  assert.equal(c.tema.color, '#0F8A7C');
});

test('normalizeLanding descarta campos desconocidos y respeta la forma', () => {
  const c = normalizeLanding({ hero: { titulo: 'Hola', hack: 'x' }, extra: 1 });
  assert.equal(c.hero.titulo, 'Hola');
  assert.ok(!('hack' in c.hero));
  assert.ok(!('extra' in (c as unknown as Record<string, unknown>)));
});

test('normalizeLanding cae al nombre por defecto si el título viene vacío', () => {
  const c = normalizeLanding({ hero: { titulo: '' } }, 'Fallback');
  assert.equal(c.hero.titulo, 'Fallback');
});

test('normalizeLanding valida el color y usa el default si es inválido', () => {
  assert.equal(normalizeLanding({ tema: { color: 'rojo' } }).tema.color, '#0F8A7C');
  assert.equal(normalizeLanding({ tema: { color: '#AABBCC' } }).tema.color, '#AABBCC');
});

test('normalizeLanding limita la cantidad de productos a 24', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ nombre: `P${i}` }));
  const c = normalizeLanding({ productos: { items } });
  assert.equal(c.productos.items.length, 24);
  assert.equal(c.productos.items[0].nombre, 'P0');
  assert.equal(c.productos.items[0].precio, '');
});

test('normalizeLanding coacciona tipos raros sin romper', () => {
  const c = normalizeLanding({ hero: { mostrar: 'sí', titulo: 123 }, productos: { items: 'no-array' } }, 'Fallback');
  assert.equal(c.hero.mostrar, true); // no era boolean → default true
  assert.equal(c.hero.titulo, 'Fallback'); // 123 no es string → '' → cae al fallback
  assert.deepEqual(c.productos.items, []);
});
