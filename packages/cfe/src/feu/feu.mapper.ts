// ============================================================================
// Traducción CfeInput (dominio) → payload de FEU, y respuesta FEU → CfeResult.
// ============================================================================

import { CFE_TIPO, COD_MONTOS_BRUTOS, FORMA_PAGO, IVA_INDICADOR, TIPO_DOC_CLIENTE } from '../codigos';
import type { CfeInput, CfeResult } from '../types';
import type { FeuCrearPayload, FeuCrearResponse, FeuItemPayload } from './feu.types';

export function toFeuPayload(input: CfeInput): FeuCrearPayload {
  const items: FeuItemPayload[] = input.items.map((it) => ({
    concepto: it.concepto,
    unidad: it.unidad,
    cantidad: it.cantidad,
    precio: it.precio,
    indicador_facturacion: IVA_INDICADOR[it.iva],
    ...(it.descuento ? { descuento: it.descuento } : {}),
  }));

  const payload: FeuCrearPayload = {
    sucursal: input.sucursal ?? 1,
    tipo_comprobante: CFE_TIPO[input.tipo],
    forma_pago: FORMA_PAGO[input.formaPago],
    moneda: input.moneda ?? 'UYU',
    cod_montos_brutos: input.codMontosBrutos ?? COD_MONTOS_BRUTOS.IVA_INCLUIDO,
    id_externo: input.idExterno,
    items,
  };

  if (input.cliente) {
    const c = input.cliente;
    payload.cliente = {
      tipo_doc: TIPO_DOC_CLIENTE[c.tipoDocumento],
      cod_pais_doc: c.codPais ?? 'UY',
      nro_doc: c.documento.replace(/[^\dA-Za-z]/g, ''), // sin puntos/guiones/espacios
      denominacion: c.razonSocial ?? c.nombre ?? 'Consumidor',
      ...(c.direccion ? { direccion: c.direccion } : {}),
    };
  }

  if (input.adenda) payload.adenda = { texto: input.adenda };

  if (input.referencia) {
    payload.referencia = [
      {
        tipo_comprobante: CFE_TIPO[input.referencia.tipo],
        serie: input.referencia.serie,
        numero: input.referencia.numero,
      },
    ];
  }

  return payload;
}

export function fromFeuResponse(res: FeuCrearResponse): CfeResult {
  return {
    providerId: res.id,
    idExterno: res.id_externo,
    tipoCodigo: res.comprobante_tipo,
    serie: res.serie,
    numero: res.numero,
    hash: res.hash,
    caeNumero: res.cae_numero != null ? String(res.cae_numero) : undefined,
    caeRangoInicio: res.cae_rango_inicio,
    caeRangoFinal: res.cae_rango_final,
    caeVencimiento: res.cae_vencimiento,
    importeTotal: res.importe_total,
    qrUrl: res.url,
    raw: res,
  };
}
