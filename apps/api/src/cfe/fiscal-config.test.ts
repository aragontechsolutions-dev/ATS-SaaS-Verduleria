import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CfeGateError,
  diffCfeConfig,
  fiscalDefaultsPorRegimen,
  resolverCfeConfig,
  type CfeConfigActual,
} from './fiscal-config.ts';

const BASE: CfeConfigActual = {
  regimenFiscal: 'REGIMEN_GENERAL' as CfeConfigActual['regimenFiscal'],
  rut: '218617380010',
  emisorRut: '218617380010',
  ambiente: 'test',
  sucursalDefault: 1,
  emisionActiva: false,
  certificadoEstado: 'SIN_CARGAR',
};

test('fiscalDefaultsPorRegimen: monotributo → SIN_CFE, general → FEU', () => {
  assert.deepEqual(fiscalDefaultsPorRegimen('MONOTRIBUTO' as never), { provider: 'SIN_CFE', codMontosBrutos: 3 });
  assert.deepEqual(fiscalDefaultsPorRegimen('MONOTRIBUTO_MIDES' as never), { provider: 'SIN_CFE', codMontosBrutos: 3 });
  assert.deepEqual(fiscalDefaultsPorRegimen('REGIMEN_GENERAL' as never), { provider: 'FEU', codMontosBrutos: 1 });
  assert.deepEqual(fiscalDefaultsPorRegimen('LITERAL_E' as never), { provider: 'FEU', codMontosBrutos: 1 });
});

test('régimen exento apaga la emisión aunque se pida activarla', () => {
  const r = resolverCfeConfig(
    { ...BASE, regimenFiscal: 'MONOTRIBUTO' as never, emisionActiva: true },
    { emisionActiva: true },
  );
  assert.equal(r.cfe.provider, 'SIN_CFE');
  assert.equal(r.cfe.emisionActiva, false);
});

test('activar emisión en test solo requiere RUT emisor (sin certificado)', () => {
  const r = resolverCfeConfig(BASE, { emisionActiva: true, ambiente: 'test' });
  assert.equal(r.cfe.emisionActiva, true);
  assert.equal(r.cfe.ambiente, 'test');
});

test('gate producción: sin certificado vigente → CfeGateError', () => {
  assert.throws(
    () => resolverCfeConfig(BASE, { ambiente: 'produccion', emisionActiva: true, confirmarProduccion: true }),
    (e: unknown) => e instanceof CfeGateError && /certificado/.test((e as Error).message),
  );
});

test('gate producción: falta confirmar el paso a prod → CfeGateError', () => {
  assert.throws(
    () =>
      resolverCfeConfig(
        { ...BASE, certificadoEstado: 'VIGENTE' },
        { ambiente: 'produccion', emisionActiva: true },
      ),
    (e: unknown) => e instanceof CfeGateError && /confirmar/.test((e as Error).message),
  );
});

test('gate producción: con certificado vigente + confirmación → activa', () => {
  const r = resolverCfeConfig(
    { ...BASE, certificadoEstado: 'VIGENTE' },
    { ambiente: 'produccion', emisionActiva: true, confirmarProduccion: true },
  );
  assert.equal(r.cfe.emisionActiva, true);
  assert.equal(r.cfe.ambiente, 'produccion');
});

test('re-guardar en prod (ya activa) no exige confirmar de nuevo', () => {
  const yaEnProd: CfeConfigActual = { ...BASE, ambiente: 'produccion', emisionActiva: true, certificadoEstado: 'VIGENTE' };
  const r = resolverCfeConfig(yaEnProd, { sucursalDefault: 2 });
  assert.equal(r.cfe.emisionActiva, true);
  assert.equal(r.cfe.sucursalDefault, 2);
});

test('rut vacío se normaliza a null; emisorRut cae al rut', () => {
  const r = resolverCfeConfig({ ...BASE, emisorRut: '' }, { rut: '  ' });
  assert.equal(r.tenant.rut, null);
  assert.equal(r.cfe.emisorRut, '');
});

test('diffCfeConfig: solo reporta lo que cambió', () => {
  const d = diffCfeConfig(
    { ambiente: 'test', emisionActiva: false, sucursal: 1 },
    { ambiente: 'produccion', emisionActiva: false, sucursal: 1 },
  );
  assert.deepEqual(d, { ambiente: { antes: 'test', despues: 'produccion' } });
});
