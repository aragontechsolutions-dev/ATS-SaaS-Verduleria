// Tipos del POS (alineados con el backend @ats/api).

export type IvaIndicador = 'EXENTO' | 'MINIMA' | 'BASICA' | 'SUSPENSO';

export type TipoDocumentoCliente = 'NIE' | 'RUC' | 'CI' | 'OTROS' | 'PASAPORTE' | 'DNI' | 'NIFE';

/** Comprador identificado en una venta (datos fiscales; sin cuenta corriente). */
export interface PosCustomer {
  id: string;
  nombre: string;
  tipoDocumento: TipoDocumentoCliente;
  documento: string | null;
  razonSocial: string | null;
  /** Saldo de puntos de fidelización. */
  puntos?: number;
}

/** Un comprador con RUC dispara e-Factura; el resto, e-Ticket identificado. */
export function esEfactura(c: PosCustomer | null | undefined): boolean {
  return !!c && c.tipoDocumento === 'RUC' && !!c.documento;
}

export interface CatalogProduct {
  id: string;
  nombre: string;
  plu: number | null;
  codigoBarras: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadVenta: string;
  esPesable: boolean;
  ivaIndicador: IvaIndicador;
  precio: number;
  imagenUrl?: string | null;
  /** Stock disponible; null = producto sin stock controlado (se vende libre). */
  stock?: number | null;
}

export type MedioPago =
  | 'EFECTIVO'
  | 'DEBITO'
  | 'CREDITO'
  | 'MERCADO_PAGO'
  | 'TRANSFERENCIA'
  | 'DINERO_ELECTRONICO'
  | 'CUENTA_CORRIENTE'
  | 'PUNTOS';

export interface CartItem {
  productId?: string;
  concepto: string;
  unidad: string;
  cantidad: number;
  precioUnit: number; // con IVA incluido
  ivaIndicador: IvaIndicador;
  descuento?: number;
  esPesable: boolean;
}

export interface SalePayment {
  medio: MedioPago;
  monto: number;
  referencia?: string;
}

/** Estado de una venta en la cola de sincronización (outbox). */
export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'error';

/** Resumen del comprobante fiscal emitido (subset del CfeDocument del backend). */
export interface CfeSummary {
  id: string;
  tipo: string;
  estado: string; // LOCAL | ENVIANDO | NE | AE | BE | CE | ERROR
  serie?: string | null;
  numero?: number | null;
  caeNumero?: string | null;
  qrUrl?: string | null;
  ultimoError?: string | null;
}

export interface OutboxSale {
  /** idempotencyKey (uuid). Es la PK y el id_externo del CFE. */
  id: string;
  fecha: string; // ISO — cuándo ocurrió (offline)
  cashSessionId?: string;
  items: CartItem[];
  payments: SalePayment[];
  total: number;
  /** Vuelto entregado en efectivo (informativo; los payments suman el total). */
  vuelto?: number;
  /** Comprador identificado (para CFE). Al backend solo se envía el customerId. */
  customer?: PosCustomer;
  /** Devolución (nota de crédito): importes negativos y referencia a la venta original. */
  esDevolucion?: boolean;
  referenciaSaleId?: string;
  /** Motivo de la devolución (se envía al backend al sincronizar). */
  motivo?: string;
  status: OutboxStatus;
  intentos: number;
  ultimoError?: string;
  /** id de la venta en el servidor una vez sincronizada. */
  serverId?: string;
  /** Comprobante emitido (cuando se pudo emitir online). */
  cfe?: CfeSummary;
  createdAt: number;
}

export interface CashSession {
  id: string;
  status: 'ABIERTA' | 'CERRADA';
  montoApertura: string | number;
  aperturaAt: string;
  sucursalId?: string | null;
  terminal?: string | null;
  terminalId?: string | null;
}

export interface CashSummary {
  ventas: number;
  totalVendido: number;
  porMedio: Record<string, number>;
  efectivoEsperado: number;
  montoApertura: number;
  ingresos: number;
  egresos: number;
  sangrias: number;
  limiteEfectivo: number | null;
  superaLimite: boolean;
}

export type CashMovementTipo = 'INGRESO' | 'EGRESO' | 'SANGRIA';

export interface ArqueoMedio {
  esperado: number;
  contado: number;
  diferencia: number;
}
