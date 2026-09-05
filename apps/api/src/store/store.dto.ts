import { OnlineOrderEstado, TipoEntrega } from '@ats/database';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- Checkout público -------------------------------------------------------

export class OrderItemDto {
  @IsString()
  productId!: string;

  /** Cantidad pedida (kg estimados si es pesable; unidades si no). */
  @IsNumber()
  @Min(0.001)
  cantidad!: number;
}

export class CreateOrderDto {
  @IsEnum(TipoEntrega)
  tipoEntrega!: TipoEntrega;

  /** Requerido si tipoEntrega = DELIVERY. */
  @IsOptional()
  @IsString()
  zonaId?: string;

  /** Franja horaria elegida (una de las configuradas). */
  @IsOptional()
  @IsString()
  franja?: string;

  @IsString()
  @MinLength(2)
  clienteNombre!: string;

  @IsString()
  @MinLength(6)
  clienteTelefono!: string;

  /** Requerida si tipoEntrega = DELIVERY. */
  @IsOptional()
  @IsString()
  direccion?: string;

  /** Punto exacto marcado en el mapa por el cliente (opcional, para delivery). */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  lng?: number;

  @IsOptional()
  @IsString()
  notas?: string;

  /** Cliente logueado: guardar esta dirección en su cuenta. */
  @IsOptional()
  @IsBoolean()
  guardarDireccion?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

// --- Admin: config + zonas --------------------------------------------------

export class SaveStoreConfigDto {
  @IsOptional()
  @IsBoolean()
  deliveryActivo?: boolean;

  @IsOptional()
  @IsBoolean()
  pickupActivo?: boolean;

  /** Franjas horarias ofrecidas en el checkout. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  franjas?: string[];

  @IsOptional()
  @IsString()
  notaCheckout?: string;
}

export class CreateZoneDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsNumber()
  @Min(0)
  costoEnvio!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pedidoMinimo?: number;

  @IsOptional()
  @IsNumber()
  orden?: number;
}

export class UpdateZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoEnvio?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pedidoMinimo?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumber()
  orden?: number;
}

// --- Admin: gestión de pedidos ----------------------------------------------

export class SetEstadoDto {
  @IsEnum(OnlineOrderEstado)
  estado!: OnlineOrderEstado;
}

export class PesajeItemDto {
  @IsString()
  itemId!: string;

  /** Cantidad real (kg pesados / unidades preparadas). */
  @IsNumber()
  @Min(0)
  cantidad!: number;
}

export class PesajeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PesajeItemDto)
  items!: PesajeItemDto[];
}
