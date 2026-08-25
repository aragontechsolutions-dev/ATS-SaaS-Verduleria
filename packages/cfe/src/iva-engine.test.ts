// Tests del motor de clasificación de IVA.
// Ejecutar: npm run build -w @ats/cfe && npm test -w @ats/cfe
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clasificarProducto, normalizarTexto, IVA_FALLBACK, type IvaRule } from './iva-engine';

const REGLAS: IvaRule[] = [
  { termino: 'tomate', ivaIndicador: 'MINIMA', esEstadoNatural: true, esImportado: false, prioridad: 0 },
  { termino: 'naranja', ivaIndicador: 'MINIMA', esEstadoNatural: true, esImportado: false, prioridad: 0 },
  { termino: 'leche', ivaIndicador: 'EXENTO', esEstadoNatural: false, esImportado: false, prioridad: 0 },
  { termino: 'gaseosa', ivaIndicador: 'BASICA', esEstadoNatural: false, esImportado: false, prioridad: 0 },
  // Regla más específica y con más prioridad debe ganar sobre "tomate".
  { termino: 'tomate seco', ivaIndicador: 'BASICA', esEstadoNatural: false, esImportado: false, prioridad: 10 },
];

test('normalizarTexto: minúsculas, sin tildes ni signos', () => {
  assert.equal(normalizarTexto('  Limón, Mandarina!! '), 'limon mandarina');
});

test('clasifica fruta/verdura a tasa mínima y estado natural', () => {
  const c = clasificarProducto('Tomate Cherry', REGLAS);
  assert.equal(c.ivaIndicador, 'MINIMA');
  assert.equal(c.esEstadoNatural, true);
  assert.equal(c.automatica, true);
  assert.equal(c.regla, 'tomate');
});

test('tolera plural y mayúsculas/tildes', () => {
  assert.equal(clasificarProducto('NARANJAS', REGLAS).regla, 'naranja');
  assert.equal(clasificarProducto('Limónes', REGLAS).regla, null); // no hay regla limon
});

test('leche → exento; gaseosa → básica', () => {
  assert.equal(clasificarProducto('Leche entera 1L', REGLAS).ivaIndicador, 'EXENTO');
  assert.equal(clasificarProducto('Gaseosa cola 2.25', REGLAS).ivaIndicador, 'BASICA');
});

test('regla más específica y prioritaria gana (tomate seco → básica)', () => {
  const c = clasificarProducto('Tomate seco en aceite', REGLAS);
  assert.equal(c.ivaIndicador, 'BASICA');
  assert.equal(c.esEstadoNatural, false);
  assert.equal(c.regla, 'tomate seco');
});

test('sin match → fallback (mínima, estado natural, no automática)', () => {
  const c = clasificarProducto('Carambola exótica', REGLAS);
  assert.deepEqual(c, IVA_FALLBACK);
  assert.equal(c.automatica, false);
});

test('nombre vacío → fallback', () => {
  assert.deepEqual(clasificarProducto('   ', REGLAS), IVA_FALLBACK);
});
