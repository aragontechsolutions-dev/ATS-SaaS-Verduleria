import { IvaIndicador, MedioPago, UnidadMedida } from '@ats/database';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSaleItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(1)
  concepto!: string;

  @IsEnum(UnidadMedida)
  unidad!: UnidadMedida;

  @IsNumber()
  @Min(0.001)
  cantidad!: number;

  /** Precio unitario con IVA incluido. */
  @IsNumber()
  @Min(0)
  precioUnit!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @IsEnum(IvaIndicador)
  ivaIndicador!: IvaIndicador;
}

export class CreateSalePaymentDto {
  @IsEnum(MedioPago)
  medio!: MedioPago;

  @IsNumber()
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsString()
  referencia?: string;
}

export class DevolucionItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(1)
  concepto!: string;

  @IsEnum(UnidadMedida)
  unidad!: UnidadMedida;

  /** Cantidad a devolver (positiva). */
  @IsNumber()
  @Min(0.001)
  cantidad!: number;

  @IsNumber()
  @Min(0)
  precioUnit!: number;

  /** Descuento proporcional de la línea devuelta. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @IsEnum(IvaIndicador)
  ivaIndicador!: IvaIndicador;
}

export class CreateDevolucionDto {
  /** Idempotencia: uuid del POS. */
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  /** Venta original (id del servidor) que se devuelve. */
  @IsString()
  originalSaleId!: string;

  @IsOptional()
  @IsString()
  cashSessionId?: string;

  /** Medio por el que se reintegra el dinero. */
  @IsEnum(MedioPago)
  medio!: MedioPago;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DevolucionItemDto)
  items!: DevolucionItemDto[];
}

export class CreateSaleDto {
  /** Idempotencia: uuid generado en el POS (sobrevive al sync offline). */
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  sucursalId?: string;

  @IsOptional()
  @IsString()
  cashSessionId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments!: CreateSalePaymentDto[];

  /** ISO date de la venta (la que ocurrió offline, no la de sync). */
  @IsOptional()
  @IsISO8601()
  fecha?: string;
}
