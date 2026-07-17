import { IvaIndicador, MedioPago, UnidadMedida } from '@ats/database';

export interface CreateSaleItemDto {
  productId?: string;
  concepto: string;
  unidad: UnidadMedida;
  cantidad: number;
  precioUnit: number; // con IVA incluido
  descuento?: number;
  ivaIndicador: IvaIndicador;
}

export interface CreateSalePaymentDto {
  medio: MedioPago;
  monto: number;
  referencia?: string;
}

export interface CreateSaleDto {
  /** Idempotencia: uuid generado en el POS (sobrevive al sync offline). */
  idempotencyKey: string;
  sucursalId?: string;
  cashSessionId?: string;
  customerId?: string;
  items: CreateSaleItemDto[];
  payments: CreateSalePaymentDto[];
  /** ISO date de la venta (la que ocurrió offline, no la de sync). */
  fecha?: string;
}
