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
}

/** Elige el tipo de CFE: e-Factura si hay cliente con RUC, si no e-Ticket. */
export function tipoCfePorVenta(sale: SaleConItems): CfeTipo {
  if (sale.customer?.tipoDocumento === 'RUC' && sale.customer.documento) {
    return 'E_FACTURA';
  }
  return 'E_TICKET';
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
    items: sale.items.map((it) => ({
      concepto: it.concepto,
      unidad: UNIDAD_MAP[it.unidad] ?? String(it.unidad).toLowerCase(),
      cantidad: Number(it.cantidad),
      precio: Number(it.precioUnit),
      iva: IVA_MAP[it.ivaIndicador],
      ...(Number(it.descuento) > 0 ? { descuento: Number(it.descuento) } : {}),
    })),
  };

  // Cliente obligatorio para e-Factura y e-Ticket > 5.000 UI.
  if (sale.customer && sale.customer.documento) {
    input.cliente = {
      tipoDocumento: DOC_MAP[sale.customer.tipoDocumento],
      documento: sale.customer.documento,
      ...(sale.customer.razonSocial ? { razonSocial: sale.customer.razonSocial } : {}),
      ...(sale.customer.direccion ? { direccion: sale.customer.direccion } : {}),
    };
  }

  return input;
}
