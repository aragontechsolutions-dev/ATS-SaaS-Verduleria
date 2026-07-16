// Tests del resolutor de IVA. Ejecutar: npm run build -w @ats/cfe && npm test -w @ats/cfe
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolverIvaIndicador } from './fiscal';

test('mostrador (consumidor final): fruta/verdura → tasa base MINIMA', () => {
  assert.equal(
    resolverIvaIndicador({ base: 'MINIMA', esEstadoNatural: true, esImportado: false, tipoCliente: 'CONSUMIDOR_FINAL' }),
    'MINIMA',
  );
});

test('mostrador: importado igual usa la base (10% al consumidor final)', () => {
  assert.equal(
    resolverIvaIndicador({ base: 'MINIMA', esEstadoNatural: true, esImportado: true, tipoCliente: 'CONSUMIDOR_FINAL' }),
    'MINIMA',
  );
});

test('B2B empresa: nacional en estado natural → IVA en SUSPENSO', () => {
  assert.equal(
    resolverIvaIndicador({ base: 'MINIMA', esEstadoNatural: true, esImportado: false, tipoCliente: 'EMPRESA' }),
    'SUSPENSO',
  );
});

test('B2B empresa: importado → tasa BASICA 22%', () => {
  assert.equal(
    resolverIvaIndicador({ base: 'MINIMA', esEstadoNatural: true, esImportado: true, tipoCliente: 'EMPRESA' }),
    'BASICA',
  );
});

test('B2B empresa: elaborado/almacén → su tasa base', () => {
  assert.equal(
    resolverIvaIndicador({ base: 'BASICA', esEstadoNatural: false, esImportado: false, tipoCliente: 'EMPRESA' }),
    'BASICA',
  );
});

test('Ente Autónomo se trata como empresa (suspenso en nacional natural)', () => {
  assert.equal(
    resolverIvaIndicador({ base: 'MINIMA', esEstadoNatural: true, esImportado: false, tipoCliente: 'ENTE_AUTONOMO' }),
    'SUSPENSO',
  );
});
