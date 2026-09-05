import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirRepartidor, haversineKm } from './dispatch.ts';

// Local de referencia: Maldonado (aprox).
const LOCAL = { lat: -34.9, lng: -54.95 };

test('haversineKm: 0 en el mismo punto; ~simétrica', () => {
  assert.equal(haversineKm(LOCAL, LOCAL), 0);
  const d1 = haversineKm(LOCAL, { lat: -34.91, lng: -54.95 });
  const d2 = haversineKm({ lat: -34.91, lng: -54.95 }, LOCAL);
  assert.ok(Math.abs(d1 - d2) < 1e-9);
  // 0.01° de latitud ≈ 1.11 km
  assert.ok(d1 > 1.0 && d1 < 1.3, `esperaba ~1.11km, dio ${d1}`);
});

test('elegirRepartidor: sin libres → null', () => {
  assert.equal(elegirRepartidor([], LOCAL), null);
});

test('elegirRepartidor: gana el más cercano al local', () => {
  const libres = [
    { userId: 'lejos', lat: -34.95, lng: -54.99 },
    { userId: 'cerca', lat: -34.901, lng: -54.951 },
    { userId: 'medio', lat: -34.92, lng: -54.96 },
  ];
  assert.equal(elegirRepartidor(libres, LOCAL), 'cerca');
});

test('elegirRepartidor: repartidor sin coords va al final salvo que sea el único', () => {
  const soloSinCoords = [{ userId: 'a', lat: null, lng: null }];
  assert.equal(elegirRepartidor(soloSinCoords, LOCAL), 'a');

  const mixto = [
    { userId: 'sin', lat: null, lng: null },
    { userId: 'con', lat: -34.905, lng: -54.955 },
  ];
  assert.equal(elegirRepartidor(mixto, LOCAL), 'con');
});

test('elegirRepartidor: sin coords del local → respeta FIFO (primero de la lista)', () => {
  const libres = [
    { userId: 'primero', lat: -34.9, lng: -54.95 },
    { userId: 'segundo', lat: -34.8, lng: -54.8 },
  ];
  assert.equal(elegirRepartidor(libres, null), 'primero');
});
