// Traducción de entidades del dominio (Prisma) → CfeInput del paquete @ats/cfe.
import type {
  CfeInput,
  CfeTipo,
  IvaIndicador as CfeIvaIndicador,
  TipoDocumentoCliente as CfeTipoDoc,
} from '@ats/cfe';
import { COD_MONTOS_BRUTOS } from '@ats/cfe';
import type {
  CfeTenantConfig,
  Customer,
  IvaIndicador,
  RegimenFiscal,
  Remito,
  RemitoItem,
  Sale,
  SaleItem,
  TipoDocumentoCliente,
  UnidadMedida,
} from '@ats/database';

/** Los nombres del enum Prisma IvaIndicador coinciden con el union del dominio CFE. */
const IVA_MAP: Record<IvaIndicador, CfeIvaIndicador> = {
  EXENTO: 'EXENTO',
  MINIMA: 'MINIMA',
  BASICA: 'BASICA',
  SUSPENSO: 'SUSPENSO',
};

const DOC_MAP: Record<TipoDocumentoCliente, CfeTipoDoc> = {
  NIE: 'NIE',
  RUC: 'RUC',
  CI: 'CI',
  OTROS: 'OTROS',
  PASAPORTE: 'PASAPORTE',
  DNI: 'DNI',
  NIFE: 'NIFE',
};

const UNIDAD_MAP: Partial<Record<UnidadMedida, string>> = {
  KG: 'kg',
  GRAMO: 'g',
  UNIDAD: 'un',
  ATADO: 'atado',
  DOCENA: 'doc',
  CAJON: 'cajón',
  BOLSA: 'bolsa',
  BANDEJA: 'bandeja',
  BIN: 'bin',
  BULTO: 'bulto',
};

/** Régimen fiscal del tenant → cod_montos_brutos. */
export function codMontosBrutosPorRegimen(regimen: RegimenFiscal): number {
  switch (regimen) {
    case 'MONOTRIBUTO':
    case 'MONOTRIBUTO_MIDES':
    case 'LITERAL_E':
    case 'IVA_MINIMO':
      return COD_MONTOS_BRUTOS.MINIMO_MONOTRIBUTO; // 3
    case 'REGIMEN_GENERAL':
    default:
      return COD_MONTOS_BRUTOS.IVA_INCLUIDO; // 1
  }
}

/** ¿El tenant emite CFE o solo ticket interno no fiscal? */
export function requiereCfe(regimen: RegimenFiscal, provider: string): boolean {
  if (provider === 'SIN_CFE') return false;
  // Monotributo está exceptuado de CFE.
  return regimen !== 'MONOTRIBUTO' && regimen !== 'MONOTRIBUTO_MIDES';
}

export interface SaleConItems extends Sale {
  items: SaleItem[];
  customer?: Customer | null;
  /** Referencia al CFE original (para notas de crédito de devolución). */
  referenciaCfe?: { tipo: CfeTipo; serie: string; numero: number } | null;
}

/**
 * Elige el tipo de CFE: e-Factura si hay cliente con RUC, si no e-Ticket. Para
 * devoluciones, la nota de crédito equivalente (NC_E_FACTURA / NC_E_TICKET).
 */
export function tipoCfePorVenta(sale: SaleConItems): CfeTipo {
  const conRuc = sale.customer?.tipoDocumento === 'RUC' && !!sale.customer.documento;
  if (sale.esDevolucion) return conRuc ? 'NC_E_FACTURA' : 'NC_E_TICKET';
  return conRuc ? 'E_FACTURA' : 'E_TICKET';
}

export function saleToCfeInput(sale: SaleConItems, cfeConfig: CfeTenantConfig, regimen: RegimenFiscal): CfeInput {
  const tipo = tipoCfePorVenta(sale);
  const input: CfeInput = {
    tipo,
    idExterno: sale.idempotencyKey,
    sucursal: cfeConfig.sucursalDefault,
    formaPago: sale.forma === 'CREDITO' ? 'CREDITO' : 'CONTADO',
    moneda: 'UYU',
    codMontosBrutos: cfeConfig.codMontosBrutos || codMontosBrutosPorRegimen(regimen),
    // Devolución: los importes se guardan negativos; el CFE (NC) lleva valores
    // positivos, así que se toma el valor absoluto de cantidad y descuento.
    items: sale.items.map((it) => ({
      concepto: it.concepto,
      unidad: UNIDAD_MAP[it.unidad] ?? String(it.unidad).toLowerCase(),
      cantidad: Math.abs(Number(it.cantidad)),
      precio: Number(it.precioUnit),
      iva: IVA_MAP[it.ivaIndicador],
      ...(Math.abs(Number(it.descuento)) > 0 ? { descuento: Math.abs(Number(it.descuento)) } : {}),
    })),
  };

  // Cliente obligatorio para e-Factura y e-Ticket > 5.000 UI.
  if (sale.customer && sale.customer.documento) {
    input.cliente = {
      tipoDocumento: DOC_MAP[sale.customer.tipoDocumento],
      documento: sale.customer.documento,
      nombre: sale.customer.nombre,
      ...(sale.customer.razonSocial ? { razonSocial: sale.customer.razonSocial } : {}),
      ...(sale.customer.direccion ? { direccion: sale.customer.direccion } : {}),
    };
  }

  // Referencia al comprobante original (devolución → nota de crédito).
  if (sale.referenciaCfe) {
    input.referencia = sale.referenciaCfe;
  }

  return input;
}

// ===========================================================================
// e-REMITO (CFE 181) — PREPARACIÓN / WIP
// ---------------------------------------------------------------------------
// Mapeo de un Remito al CfeInput para el futuro e-Remito fiscal. NO está
// conectado a ninguna ruta todavía. PENDIENTE de validar contra FEU/DGI y con
// el contador (ver docs/E-REMITO.md): tratamiento de IVA/valores del 181,
// campos obligatorios y si el remito va "con" o "sin" valores.
// ===========================================================================

export interface RemitoConItems extends Remito {
  items: RemitoItem[];
}

export function remitoToCfeInput(
  remito: RemitoConItems,
  cfeConfig: CfeTenantConfig,
  regimen: RegimenFiscal,
  opts?: {
    /** Precios netos por productId (si el remito se emite con valores). */
    precios?: Record<string, number>;
    /** IVA a aplicar en el 181 (a definir con el contador). */
    iva?: CfeIvaIndicador;
    /** Tipo de documento del receptor (el remito hoy solo guarda el número). */
    tipoDocumento?: TipoDocumentoCliente;
  },
): CfeInput {
  const ivaRemito: CfeIvaIndicador = opts?.iva ?? 'EXENTO'; // TODO: definir
  const input: CfeInput = {
    tipo: 'E_REMITO',
    idExterno: `remito-${remito.id}`,
    sucursal: cfeConfig.sucursalDefault,
    formaPago: 'CONTADO',
    moneda: 'UYU',
    codMontosBrutos: cfeConfig.codMontosBrutos || codMontosBrutosPorRegimen(regimen),
    items: remito.items.map((it) => ({
      concepto: it.concepto,
      unidad: UNIDAD_MAP[it.unidad as UnidadMedida] ?? String(it.unidad).toLowerCase(),
      cantidad: Number(it.cantidad),
      // TODO(e-remito): el remito no guarda precio; el 181 puede ir sin valores
      // o con importes. Definir con el contador. Por ahora 0 o el provisto.
      precio: (it.productId && opts?.precios?.[it.productId]) || 0,
      iva: ivaRemito,
    })),
  };

  if (remito.clienteDoc) {
    input.cliente = {
      tipoDocumento: DOC_MAP[opts?.tipoDocumento ?? 'RUC'],
      documento: remito.clienteDoc,
      nombre: remito.clienteNombre,
    };
  }

  const adenda = [remito.destino ? `Destino: ${remito.destino}` : null, remito.matricula ? `Matrícula: ${remito.matricula}` : null, remito.transportista ? `Transportista: ${remito.transportista}` : null]
    .filter(Boolean)
    .join(' · ');
  if (adenda) input.adenda = adenda;

  return input;
}
