// ============================================================================
// Tipos de cable de la API de FEU (Surtec). Reflejan los payloads/respuestas
// verificados en CONTEXTOFEU.md. No usar fuera del provider FEU.
// ============================================================================

export interface FeuTokenResponse {
  access_token: string;
  token_type: string; // "bearer"
  refresh_token: string;
  expires_in?: number;
}

export interface FeuItemPayload {
  concepto: string;
  unidad: string;
  cantidad: number;
  precio: number;
  indicador_facturacion: number;
  descuento?: number;
}

export interface FeuClientePayload {
  tipo_documento: number;
  documento: string;
  razon_social?: string;
  direccion?: string;
}

export interface FeuReferenciaPayload {
  tipo_comprobante: number;
  serie: string;
  numero: number;
}

export interface FeuCrearPayload {
  sucursal: number;
  tipo_comprobante: number;
  forma_pago: number;
  moneda: string;
  cod_montos_brutos: number;
  id_externo: string;
  items: FeuItemPayload[];
  cliente?: FeuClientePayload;
  adenda?: { texto: string };
  referencia?: FeuReferenciaPayload[];
}

export interface FeuCrearResponse {
  id: number;
  id_externo: string;
  comprobante_tipo: number;
  serie: string;
  numero: number;
  importe_total: number;
  hash: string;
  cae_numero: number | string;
  cae_rango_inicio: number;
  cae_rango_final: number;
  cae_vencimiento: string;
  url: string;
}

export interface FeuEstadoDgi {
  codigo: string; // NE | AE | BE | CE
  descripcion?: string;
}

/** Respuesta de GET /comprobantes/{id} (datos + estado). */
export interface FeuComprobanteResponse {
  id: number;
  id_externo?: string;
  comprobante_tipo?: number;
  serie?: string;
  numero?: number;
  importe_total?: number;
  hash?: string;
  cae_numero?: number | string;
  cae_rango_inicio?: number;
  cae_rango_final?: number;
  cae_vencimiento?: string;
  url?: string;
  estado_dgi?: FeuEstadoDgi;
  estado?: FeuEstadoDgi | string;
}

/** Respuesta del endpoint /pdf: JSON con el PDF en base64 (NO binario). */
export interface FeuPdfResponse {
  file_name: string;
  mime_type: string;
  format: string; // "base64"
  data: string; // PDF en base64
}

export interface FeuActividadEmpresarial {
  rut?: string;
  razon_social?: string;
  nombre_fantasia?: string;
  denominacion?: string;
  direccion?: string;
}
