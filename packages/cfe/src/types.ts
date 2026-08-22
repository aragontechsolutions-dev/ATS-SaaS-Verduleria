// ============================================================================
// Tipos de dominio del CFE (agnósticos del proveedor).
// La app trabaja siempre con estos tipos; cada proveedor (FEU, Host Factura…)
// implementa CfeProvider y traduce a/desde su formato de cable.
// ============================================================================

export type CfeAmbiente = 'test' | 'produccion';

/** Indicador de IVA por ítem. Se traduce a indicador_facturacion del proveedor. */
export type IvaIndicador = 'EXENTO' | 'MINIMA' | 'BASICA' | 'SUSPENSO';

/** Tipo de comprobante. Se traduce al código DGI (101, 111, …). */
export type CfeTipo =
  | 'E_TICKET' // 101
  | 'NC_E_TICKET' // 102
  | 'ND_E_TICKET' // 103
  | 'E_FACTURA' // 111
  | 'NC_E_FACTURA' // 112
  | 'ND_E_FACTURA' // 113
  | 'E_REMITO' // 181
  | 'E_RESGUARDO'; // 182

export type FormaPago = 'CONTADO' | 'CREDITO';

export type TipoDocumentoCliente =
  | 'NIE' // 1
  | 'RUC' // 2 (UY)
  | 'CI' // 3 (UY)
  | 'OTROS' // 4
  | 'PASAPORTE' // 5
  | 'DNI' // 6 (AR/BR/CL/PY)
  | 'NIFE'; // 7

/** Estado del comprobante frente a DGI. */
export type EstadoDgiCodigo = 'NE' | 'AE' | 'BE' | 'CE';

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

export interface CfeItemInput {
  concepto: string;
  unidad: string; // 'kg' | 'un' | 'atado' | 'cajón' …
  cantidad: number;
  /** Precio unitario. Con IVA incluido cuando codMontosBrutos = 1. */
  precio: number;
  iva: IvaIndicador;
  descuento?: number;
}

export interface CfeClienteInput {
  tipoDocumento: TipoDocumentoCliente;
  documento: string;
  razonSocial?: string;
  direccion?: string;
}

export interface CfeInput {
  tipo: CfeTipo;
  /** Idempotencia: debe ser el sale_id del SaaS. Reintentar no duplica. */
  idExterno: string;
  sucursal?: number;
  formaPago: FormaPago;
  moneda?: string; // default 'UYU'
  /**
   * Régimen fiscal (switch para servir a los dos regímenes):
   *  1 = líneas con IVA incluido (Régimen General / IVA mínimo normal)
   *  3 = obligación IVA mínimo, Monotributo o Monotributo MIDES
   */
  codMontosBrutos?: number;
  items: CfeItemInput[];
  cliente?: CfeClienteInput; // obligatorio para e-Factura y e-Ticket > 5.000 UI
  adenda?: string;
  /** Referencia a comprobante original (para NC/ND). */
  referencia?: { tipo: CfeTipo; serie: string; numero: number };
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export interface CfeResult {
  /** id interno del proveedor (FEU). */
  providerId: number;
  idExterno: string;
  tipoCodigo: number; // 101, 111, …
  serie?: string;
  numero?: number;
  hash?: string;
  caeNumero?: string;
  caeRangoInicio?: number;
  caeRangoFinal?: number;
  caeVencimiento?: string; // ISO
  importeTotal?: number;
  qrUrl?: string;
  raw?: unknown;
}

export interface EstadoDgiResult {
  codigo: EstadoDgiCodigo | string;
  descripcion?: string;
  /** true si el estado es terminal (AE/BE/CE) y no requiere seguir consultando. */
  esFinal: boolean;
  serie?: string;
  numero?: number;
  raw?: unknown;
}

export interface PdfResult {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface EmpresaDatos {
  rut: string;
  razonSocial?: string;
  nombreFantasia?: string;
  direccion?: string;
  raw?: unknown;
}

// ---------------------------------------------------------------------------
// Interfaz común del proveedor de CFE
// ---------------------------------------------------------------------------

export interface CfeProvider {
  readonly nombre: string;

  /** Emite un CFE. Idempotente por input.idExterno. */
  emitir(emisorRut: string, input: CfeInput): Promise<CfeResult>;

  /** Consulta el estado DGI de un comprobante ya emitido (para polling). */
  consultarEstado(emisorRut: string, providerId: number): Promise<EstadoDgiResult>;

  /** Descarga el PDF (A4 por defecto o ticket 80mm). */
  obtenerPdf(emisorRut: string, providerId: number, tipo?: 'A4' | 'ticket80'): Promise<PdfResult>;

  /** Recupera un comprobante por su id_externo (idempotencia). null si no existe. */
  consultarPorIdExterno(emisorRut: string, idExterno: string): Promise<CfeResult | null>;

  /** Datos de una empresa por RUT (para onboarding / autocompletar). */
  consultarActividadEmpresarial(rut: string): Promise<EmpresaDatos>;
}

/** Error normalizado del proveedor de CFE. */
export class CfeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detalle?: unknown,
  ) {
    super(message);
    this.name = 'CfeError';
  }
}
