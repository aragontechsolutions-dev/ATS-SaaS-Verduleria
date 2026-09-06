import { MedioPago, PaymentProviderKind } from '@ats/database';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Registro MANUAL de un pago hecho por una vía no integrada al SaaS (Getnet,
 * Handy, Scanntech, Fiserv, transferencia, efectivo…). Debe apuntar a una venta
 * (saleId) o a un pedido online (onlineOrderId).
 */
export class RegistrarPagoDto {
  @IsOptional()
  @IsString()
  saleId?: string;

  @IsOptional()
  @IsString()
  onlineOrderId?: string;

  @IsEnum(MedioPago)
  medio!: MedioPago;

  @IsNumber()
  @Min(0.01)
  monto!: number;

  /** Vía por la que se cobró (para saber que fue externo). Default MANUAL. */
  @IsOptional()
  @IsEnum(PaymentProviderKind)
  provider?: PaymentProviderKind;

  /** Nº de cupón/lote del posnet, id de transferencia, etc. */
  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  nota?: string;
}
