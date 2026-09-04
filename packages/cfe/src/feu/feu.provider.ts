// ============================================================================
// FeuProvider — implementación de CfeProvider contra la API de FEU (Surtec).
//
// Un solo login (credenciales de ATS partner) sirve para MÚLTIPLES RUTs: el
// RUT del tenant se manda en X-Emisor en cada request (multi-tenant nativo).
// Todo lo verificado está documentado en CONTEXTOFEU.md.
// ============================================================================

import { CfeError } from '../types';
import type {
  CfeInput,
  CfeProvider,
  CfeResult,
  EmpresaDatos,
  EstadoDgiResult,
  PdfResult,
} from '../types';
import { esEstadoFinal } from '../codigos';
import { FeuClient, type FeuClientConfig } from './feu.client';
import { fromFeuResponse, toFeuPayload } from './feu.mapper';
import type {
  FeuActividadEmpresarial,
  FeuCrearResponse,
  FeuEmitidoItem,
  FeuPdfResponse,
} from './feu.types';

export class FeuProvider implements CfeProvider {
  readonly nombre = 'FEU';
  private readonly client: FeuClient;

  constructor(config: FeuClientConfig) {
    this.client = new FeuClient(config);
  }

  /** Emite un CFE. Idempotente por id_externo (= sale_id). */
  async emitir(emisorRut: string, input: CfeInput): Promise<CfeResult> {
    const payload = toFeuPayload(input);
    const res = await this.client.request<FeuCrearResponse>('POST', '/comprobantes/crear', {
      emisorRut,
      body: payload,
    });
    return fromFeuResponse(res);
  }

  /**
   * Consulta el estado DGI de un comprobante ya emitido (para polling NE→AE).
   * VERIFICADO (sandbox 2026-09): GET /comprobantes/{id} NO trae estado_dgi;
   * el estado real vive en GET /consulta/comprobantes/emitidos por fecha. Se
   * busca el comprobante por su id dentro de la lista del día de emisión.
   */
  async consultarEstado(emisorRut: string, providerId: number, fechaEmision?: string): Promise<EstadoDgiResult> {
    const fecha = fechaEmision ?? new Date().toISOString().slice(0, 10);
    const res = await this.client.request<unknown>('GET', '/consulta/comprobantes/emitidos', {
      emisorRut,
      query: { FechaDesde: fecha, FechaHasta: fecha },
    });
    const lista = extraerLista(res);
    const item = lista.find((x) => x.id === providerId);
    const codigo = item?.estado_dgi?.codigo ?? 'NE';
    return {
      codigo,
      descripcion: item?.estado_dgi?.descripcion,
      esFinal: esEstadoFinal(codigo),
      serie: item?.serie,
      numero: item?.numero,
      raw: item ?? res,
    };
  }

  /**
   * Descarga el PDF. HALLAZGO NO OBVIO (CONTEXTOFEU.md §5): el endpoint NO
   * devuelve binario, sino un JSON con el PDF en base64. Hay que decodificar.
   */
  async obtenerPdf(emisorRut: string, providerId: number, tipo: 'A4' | 'ticket80' = 'A4'): Promise<PdfResult> {
    const res = await this.client.requestRaw('GET', `/comprobantes/${providerId}/pdf`, {
      emisorRut,
      query: tipo === 'ticket80' ? { tipo: 'ticket80' } : undefined,
    });
    if (!res.ok) {
      const detalle = await res.json().catch(() => res.statusText);
      throw new CfeError(`FEU obtenerPdf falló (HTTP ${res.status})`, res.status, detalle);
    }
    const json = (await res.json()) as FeuPdfResponse;
    if (json.format !== 'base64' || !json.data) {
      throw new CfeError('FEU obtenerPdf: formato inesperado (se esperaba JSON base64)', res.status, json);
    }
    const buffer = Buffer.from(json.data, 'base64');
    // Validación: un PDF válido empieza con "%PDF".
    if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
      throw new CfeError('FEU obtenerPdf: el base64 decodificado no es un PDF válido', res.status);
    }
    return { fileName: json.file_name, mimeType: json.mime_type, buffer };
  }

  /** Recupera un comprobante por id_externo (idempotencia). null si 404. */
  async consultarPorIdExterno(emisorRut: string, idExterno: string): Promise<CfeResult | null> {
    try {
      const res = await this.client.request<FeuCrearResponse>(
        'GET',
        `/comprobantes/e/${encodeURIComponent(idExterno)}`,
        { emisorRut },
      );
      return fromFeuResponse(res);
    } catch (err) {
      if (err instanceof CfeError && err.status === 404) return null;
      throw err;
    }
  }

  /** Datos de empresa por RUT (onboarding / autocompletar razón social). */
  async consultarActividadEmpresarial(rut: string): Promise<EmpresaDatos> {
    const res = await this.client.request<FeuActividadEmpresarial>(
      'GET',
      `/consulta-dgi/actividad-empresarial/${encodeURIComponent(rut)}`,
    );
    return {
      rut: res.rut ?? rut,
      razonSocial: res.razon_social ?? res.denominacion,
      nombreFantasia: res.nombre_fantasia,
      direccion: res.direccion,
      raw: res,
    };
  }
}

/** Extrae la lista de comprobantes de la respuesta de /emitidos (array o {comprobantes|items}). */
function extraerLista(res: unknown): FeuEmitidoItem[] {
  if (Array.isArray(res)) return res as FeuEmitidoItem[];
  const obj = (res ?? {}) as { comprobantes?: unknown; items?: unknown };
  if (Array.isArray(obj.comprobantes)) return obj.comprobantes as FeuEmitidoItem[];
  if (Array.isArray(obj.items)) return obj.items as FeuEmitidoItem[];
  return [];
}
