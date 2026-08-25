import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultLanding, normalizeLanding, normalizeUyPhone } from './landing.types.ts';

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

test('normalizeLanding: productIds solo strings, sin vacíos y hasta 24', () => {
  const ids = Array.from({ length: 30 }, (_, i) => `id-${i}`);
  const c = normalizeLanding({ productos: { productIds: [...ids, '', 123, null] } });
  assert.equal(c.productos.productIds.length, 24);
  assert.equal(c.productos.productIds[0], 'id-0');
  assert.ok(!c.productos.productIds.includes(''));
});

test('normalizeLanding: productIds ausente → []', () => {
  const c = normalizeLanding({ productos: {} });
  assert.deepEqual(c.productos.productIds, []);
});

test('normalizeUyPhone: 099… → +598 con bloques', () => {
  assert.equal(normalizeUyPhone('099123456'), '+598 99 123 456');
  assert.equal(normalizeUyPhone('099 123 456'), '+598 99 123 456');
});

test('normalizeUyPhone: acepta ya con +598 o 598', () => {
  assert.equal(normalizeUyPhone('+598 99 123 456'), '+598 99 123 456');
  assert.equal(normalizeUyPhone('59899123456'), '+598 99 123 456');
});

test('normalizeUyPhone: vacío o sin dígitos → ""', () => {
  assert.equal(normalizeUyPhone(''), '');
  assert.equal(normalizeUyPhone('sin numero'), '');
});

test('normalizeLanding: normaliza whatsapp/telefono y valida coordenadas', () => {
  const c = normalizeLanding({
    contacto: { whatsapp: '099123456' },
    horarios: { lat: -34.9011, lng: -56.1645, texto: 'x' },
  });
  assert.equal(c.contacto.whatsapp, '+598 99 123 456');
  assert.equal(c.horarios.lat, -34.9011);
  assert.equal(c.horarios.lng, -56.1645);
});

test('normalizeLanding: coordenadas fuera de rango → 0', () => {
  const c = normalizeLanding({ horarios: { lat: 999, lng: 'abc' } });
  assert.equal(c.horarios.lat, 0);
  assert.equal(c.horarios.lng, 0);
});

test('normalizeLanding coacciona tipos raros sin romper', () => {
  const c = normalizeLanding({ hero: { mostrar: 'sí', titulo: 123 }, productos: { items: 'no-array' } }, 'Fallback');
  assert.equal(c.hero.mostrar, true); // no era boolean → default true
  assert.equal(c.hero.titulo, 'Fallback'); // 123 no es string → '' → cae al fallback
  assert.deepEqual(c.productos.items, []);
});
