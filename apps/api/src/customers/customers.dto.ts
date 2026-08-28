import { MedioPago, TipoDocumentoCliente } from '@ats/database';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsOptional()
  @IsBoolean()
  esMayorista?: boolean;

  @IsOptional()
  @IsEnum(TipoDocumentoCliente)
  tipoDocumento?: TipoDocumentoCliente;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  priceListId?: string;

  /** Límite de crédito para la cuenta corriente (0 = sin límite definido). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredito?: number;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  esMayorista?: boolean;

  @IsOptional()
  @IsEnum(TipoDocumentoCliente)
  tipoDocumento?: TipoDocumentoCliente;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredito?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/**
 * Alta rápida de cliente desde el POS (identificación fiscal del comprador).
 * No es mayorista ni abre cuenta corriente; sirve para e-Factura / e-Ticket
 * con comprador identificado (obligatorio > 5.000 UI).
 */
export class QuickCustomerDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEnum(TipoDocumentoCliente)
  tipoDocumento!: TipoDocumentoCliente;

  @IsString()
  @MinLength(3)
  documento!: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  direccion?: string;
}

/** Cobranza: reduce el saldo de la cuenta corriente. */
export class PaymentDto {
  @IsNumber()
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsString()
  concepto?: string;
}

/**
 * Cobranza desde el POS: baja el saldo de la cuenta corriente y, si es en
 * efectivo con un turno de caja abierto, ingresa el efectivo a la caja.
 */
export class CobranzaDto {
  @IsNumber()
  @Min(0.01)
  monto!: number;

  @IsEnum(MedioPago)
  medio!: MedioPago;

  @IsOptional()
  @IsString()
  cashSessionId?: string;

  @IsOptional()
  @IsString()
  concepto?: string;
}

/** Cargo manual: aumenta el saldo (ajuste/deuda fuera de una venta). */
export class ChargeDto {
  @IsNumber()
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsString()
  concepto?: string;
}
