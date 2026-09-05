// ============================================================================
// Resolución de la configuración fiscal (CFE) de un tenant.
//
// Funciones PURAS (sin NestJS/Prisma) para poder testearlas con node:test.
// La edición de esta config vive SOLO en la Consola (Aragon); el panel del
// tenant la muestra en modo lectura. Acá se deriva el proveedor/cod_montos_brutos
// del régimen y se valida el "doble gate" para pasar a producción.
// ============================================================================

import type { RegimenFiscal, CertificadoEstado } from '@ats/database';

export interface FiscalDefaults {
  provider: string; // 'FEU' | 'SIN_CFE'
  codMontosBrutos: number; // 1 IVA incluido / 3 IVA mínimo-monotributo
}

/** Deriva proveedor CFE y cod_montos_brutos del régimen fiscal. */
export function fiscalDefaultsPorRegimen(regimen: RegimenFiscal): FiscalDefaults {
  // Comparación por string (los valores del enum Prisma son sus nombres) para
  // no forzar la importación del enum en runtime (node:test strip-types).
  const exento = regimen === 'MONOTRIBUTO' || regimen === 'MONOTRIBUTO_MIDES';
  return exento
    ? { provider: 'SIN_CFE', codMontosBrutos: 3 } // exceptuado de CFE (ticket interno)
    : { provider: 'FEU', codMontosBrutos: 1 }; // obligado a CFE (IVA incluido)
}

export interface CfeConfigActual {
  regimenFiscal: RegimenFiscal;
  rut: string | null;
  emisorRut: string;
  ambiente: string; // 'test' | 'produccion'
  sucursalDefault: number;
  emisionActiva: boolean;
  certificadoEstado: string; // CertificadoEstado
}

export interface CfeConfigCambios {
  regimenFiscal?: RegimenFiscal;
  rut?: string | null;
  emisorRut?: string;
  ambiente?: 'test' | 'produccion';
  sucursalDefault?: number;
  emisionActiva?: boolean;
  certificadoEstado?: CertificadoEstado;
  /** Requerido para PRENDER la emisión en producción (checklist confirmado). */
  confirmarProduccion?: boolean;
}

export interface ResolvedCfeConfig {
  tenant: { rut: string | null; regimenFiscal: RegimenFiscal };
  cfe: {
    provider: string;
    ambiente: string;
    emisorRut: string;
    sucursalDefault: number;
    codMontosBrutos: number;
    emisionActiva: boolean;
    certificadoEstado: string;
  };
}

/** Error de validación del gate de producción (mensaje apto para el usuario). */
export class CfeGateError extends Error {}

/**
 * Aplica los cambios sobre el estado actual, deriva provider/cod_montos_brutos
 * del régimen y valida el doble gate de producción. Lanza CfeGateError si no
 * se cumplen las precondiciones para emitir en producción.
 */
export function resolverCfeConfig(actual: CfeConfigActual, cambios: CfeConfigCambios): ResolvedCfeConfig {
  const regimenFiscal = cambios.regimenFiscal ?? actual.regimenFiscal;
  const { provider, codMontosBrutos } = fiscalDefaultsPorRegimen(regimenFiscal);

  const rut = cambios.rut !== undefined ? cambios.rut?.trim() || null : actual.rut;
  const emisorRut = (cambios.emisorRut ?? actual.emisorRut ?? rut ?? '').trim();
  const ambiente = cambios.ambiente ?? actual.ambiente;
  const sucursalDefault = cambios.sucursalDefault ?? actual.sucursalDefault;
  const certificadoEstado = cambios.certificadoEstado ?? actual.certificadoEstado;

  // Si el régimen es exento (SIN_CFE) la emisión siempre queda apagada.
  const emisionActiva = provider === 'SIN_CFE' ? false : (cambios.emisionActiva ?? actual.emisionActiva);

  // Doble gate: activar la emisión REAL en producción exige checklist.
  if (emisionActiva && ambiente === 'produccion') {
    const faltantes: string[] = [];
    if (!emisorRut) faltantes.push('falta el RUT emisor');
    if (certificadoEstado !== 'VIGENTE') faltantes.push('el certificado no está vigente');
    // La confirmación explícita solo se exige al PRENDER prod (no en re-guardados).
    const yaEnProd = actual.emisionActiva && actual.ambiente === 'produccion';
    if (!yaEnProd && !cambios.confirmarProduccion) faltantes.push('falta confirmar el paso a producción');
    if (faltantes.length) {
      throw new CfeGateError(`No se puede activar la emisión en producción: ${faltantes.join('; ')}.`);
    }
  }

  return {
    tenant: { rut, regimenFiscal },
    cfe: { provider, ambiente, emisorRut, sucursalDefault, codMontosBrutos, emisionActiva, certificadoEstado },
  };
}

/** Diff plano (antes/después) de los campos fiscales, para el audit log. */
export function diffCfeConfig(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
): Record<string, { antes: unknown; despues: unknown }> {
  const out: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const k of Object.keys(despues)) {
    if (antes[k] !== despues[k]) out[k] = { antes: antes[k] ?? null, despues: despues[k] ?? null };
  }
  return out;
}
