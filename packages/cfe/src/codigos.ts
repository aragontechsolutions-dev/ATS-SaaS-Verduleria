// ============================================================================
// Mapeos entre los tipos de dominio y los códigos de DGI/FEU.
// Fuente: CONTEXTOFEU.md (verificado empíricamente contra api-test de FEU).
// ============================================================================

import type { CfeTipo, EstadoDgiCodigo, FormaPago, IvaIndicador, TipoDocumentoCliente } from './types';

/** indicador_facturacion (por ítem). */
export const IVA_INDICADOR: Record<IvaIndicador, number> = {
  EXENTO: 1,
  MINIMA: 2, // 10% — frutas y verduras
  BASICA: 3, // 22% — elaborados / envasados
  SUSPENSO: 12, // IVA en suspenso (cadena / compras a productor)
};

/** tipo_comprobante (tabla DGI). */
export const CFE_TIPO: Record<CfeTipo, number> = {
  E_TICKET: 101,
  NC_E_TICKET: 102,
  ND_E_TICKET: 103,
  E_FACTURA: 111,
  NC_E_FACTURA: 112,
  ND_E_FACTURA: 113,
  E_REMITO: 181,
  E_RESGUARDO: 182,
};

export const CFE_TIPO_INVERSO: Record<number, CfeTipo> = Object.fromEntries(
  Object.entries(CFE_TIPO).map(([k, v]) => [v, k as CfeTipo]),
) as Record<number, CfeTipo>;

/** forma_pago. */
export const FORMA_PAGO: Record<FormaPago, number> = {
  CONTADO: 1,
  CREDITO: 2,
};

/** tipo de documento del cliente. */
export const TIPO_DOC_CLIENTE: Record<TipoDocumentoCliente, number> = {
  NIE: 1,
  RUC: 2,
  CI: 3,
  OTROS: 4,
  PASAPORTE: 5,
  DNI: 6,
  NIFE: 7,
};

/** Estados DGI terminales (no requieren seguir consultando). */
export const ESTADOS_FINALES: ReadonlySet<string> = new Set<EstadoDgiCodigo>(['AE', 'BE', 'CE']);

export function esEstadoFinal(codigo: string | undefined | null): boolean {
  return codigo != null && ESTADOS_FINALES.has(codigo);
}

/** cod_montos_brutos por régimen fiscal. */
export const COD_MONTOS_BRUTOS = {
  /** Líneas con IVA incluido (Régimen General / IVA mínimo normal). */
  IVA_INCLUIDO: 1,
  /** IMEBA y adicionales incluidos. */
  IMEBA: 2,
  /** Obligación IVA mínimo, Monotributo o Monotributo MIDES. */
  MINIMO_MONOTRIBUTO: 3,
} as const;
