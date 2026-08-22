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
  FeuComprobanteResponse,
  FeuCrearResponse,
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
   * Usa GET /comprobantes/{id}, que trae estado_dgi. (El path verificado de
   * polling en CONTEXTOFEU.md es el de emitidos por fecha; este por id es el
   * camino directo. Si estado_dgi no viene, se reporta NE para reintentar.)
   */
  async consultarEstado(emisorRut: string, providerId: number): Promise<EstadoDgiResult> {
    const res = await this.client.request<FeuComprobanteResponse>('GET', `/comprobantes/${providerId}`, {
      emisorRut,
    });
    const estado = normalizarEstado(res);
    return {
      codigo: estado?.codigo ?? 'NE',
      descripcion: estado?.descripcion,
      esFinal: esEstadoFinal(estado?.codigo),
      serie: res.serie,
      numero: res.numero,
      raw: res,
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

function normalizarEstado(res: FeuComprobanteResponse): { codigo: string; descripcion?: string } | undefined {
  if (res.estado_dgi) return res.estado_dgi;
  if (typeof res.estado === 'string') return { codigo: res.estado };
  if (res.estado && typeof res.estado === 'object') return res.estado;
  return undefined;
}
