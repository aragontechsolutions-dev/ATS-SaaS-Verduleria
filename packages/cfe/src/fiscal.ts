// ============================================================================
// Resolución de la tasa de IVA (indicador) según el producto Y el tipo de
// cliente. Fuente: docs/CFE-IVA.md (normativa DGI verificada).
//
// Regla central (verdulería):
//  - Fruta/verdura/flor en estado natural a CONSUMIDOR FINAL → tasa MÍNIMA (10%).
//  - A EMPRESA (mayoreo B2B):
//      · nacional en estado natural → IVA en SUSPENSO (sin IVA en factura)
//      · importado                  → tasa BÁSICA (22%)
//      · elaborado / almacén        → su tasa base normal
//
// El 95% de la operación es mostrador (consumidor final) → devuelve la base.
// La rama B2B se usa al emitir e-Factura (tipo 111) a clientes con RUC.
// ⚠️ El indicador exacto de "IVA en suspenso" en líneas B2B (probablemente 12)
//    está PENDIENTE de confirmar con Surtec (docs/CFE-IVA.md §5).
// ============================================================================

import type { IvaIndicador } from './types';

/**
 * Trato fiscal del cliente frente al IVA:
 *  - CONSUMIDOR_FINAL: mostrador, ANEP/escuelas y otros organismos comunes.
 *  - EMPRESA: contribuyente IRAE (restaurante, hotel, otra verdulería) con RUC.
 *  - ENTE_AUTONOMO: Entes Autónomos / Servicios Descentralizados → como EMPRESA.
 */
export type TipoClienteFiscal = 'CONSUMIDOR_FINAL' | 'EMPRESA' | 'ENTE_AUTONOMO';

export interface ResolverIvaParams {
  /** Tasa base del producto a consumidor final. */
  base: IvaIndicador;
  /** ¿Es fruta/verdura/flor en estado natural? */
  esEstadoNatural: boolean;
  /** ¿Es importado? */
  esImportado: boolean;
  /** Trato fiscal del cliente. */
  tipoCliente: TipoClienteFiscal;
}

export function resolverIvaIndicador(params: ResolverIvaParams): IvaIndicador {
  const { base, esEstadoNatural, esImportado, tipoCliente } = params;

  // Consumidor final (mostrador): siempre la tasa base del producto. Cubre el 95%.
  if (tipoCliente === 'CONSUMIDOR_FINAL') return base;

  // Mayoreo B2B (empresa / ente autónomo):
  if (esEstadoNatural && !esImportado) return 'SUSPENSO'; // nacional en estado natural
  if (esImportado) return 'BASICA'; // importado → 22%
  return base; // elaborado / almacén → su tasa normal
}
