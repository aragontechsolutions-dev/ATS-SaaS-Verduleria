import { BadRequestException } from '@nestjs/common';
import type { Provider } from '@nestjs/common';

/** Token de inyección del proveedor de pagos ONLINE (Fase 1: Mercado Pago). */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentIntent {
  tenantId: string;
  onlineOrderId: string;
  monto: number;
  descripcion?: string;
  backUrl?: string;
}

export interface PaymentInitResult {
  /** URL de checkout / preferencia a la que redirigir al cliente. */
  checkoutUrl: string;
  providerRef: string;
}

/**
 * Proveedor de cobro ONLINE. En la Fase 0 no hay ninguno integrado (los pagos se
 * registran a mano). En la Fase 1 se implementa MercadoPagoProvider con esta
 * interfaz y se enchufa cambiando la factory (idéntico patrón al CFE_PROVIDER).
 */
export interface PaymentProvider {
  readonly nombre: string;
  crearPagoOnline(intent: PaymentIntent): Promise<PaymentInitResult>;
}

/** Proveedor por defecto: no hay cobro online integrado. Guía al registro manual. */
export class SinPagosProvider implements PaymentProvider {
  readonly nombre = 'SIN_PAGOS';
  async crearPagoOnline(): Promise<PaymentInitResult> {
    throw new BadRequestException(
      'No hay una pasarela de pago online configurada. Registrá el pago manualmente cuando se cobre.',
    );
  }
}

/** Factory del proveedor de pagos. Hoy siempre SIN_PAGOS (Fase 1: Mercado Pago por tenant). */
export const paymentProviderFactory: Provider = {
  provide: PAYMENT_PROVIDER,
  useFactory: () => new SinPagosProvider(),
};
