// Tipos del POS (alineados con el backend @ats/api).

export type IvaIndicador = 'EXENTO' | 'MINIMA' | 'BASICA' | 'SUSPENSO';

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
}

export type MedioPago =
  | 'EFECTIVO'
  | 'DEBITO'
  | 'CREDITO'
  | 'MERCADO_PAGO'
  | 'TRANSFERENCIA'
  | 'DINERO_ELECTRONICO'
  | 'CUENTA_CORRIENTE';

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

export interface OutboxSale {
  /** idempotencyKey (uuid). Es la PK y el id_externo del CFE. */
  id: string;
  fecha: string; // ISO — cuándo ocurrió (offline)
  items: CartItem[];
  payments: SalePayment[];
  total: number;
  status: OutboxStatus;
  intentos: number;
  ultimoError?: string;
  /** id de la venta en el servidor una vez sincronizada. */
  serverId?: string;
  createdAt: number;
}
