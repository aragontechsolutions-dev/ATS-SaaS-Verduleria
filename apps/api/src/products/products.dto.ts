import { IvaIndicador, UnidadMedida } from '@ats/database';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEnum(UnidadMedida)
  unidadVenta!: UnidadMedida;

  @IsBoolean()
  esPesable!: boolean;

  @IsEnum(IvaIndicador)
  ivaIndicador!: IvaIndicador;

  /** Precio de mostrador (con IVA incluido). */
  @IsNumber()
  @Min(0)
  precio!: number;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsInt()
  plu?: number;

  @IsOptional()
  @IsString()
  codigoBarras?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsEnum(UnidadMedida)
  unidadVenta?: UnidadMedida;

  @IsOptional()
  @IsBoolean()
  esPesable?: boolean;

  @IsOptional()
  @IsEnum(IvaIndicador)
  ivaIndicador?: IvaIndicador;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio?: number;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsInt()
  plu?: number;

  @IsOptional()
  @IsString()
  codigoBarras?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CreateCategoriaDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsOptional()
  @IsEnum(IvaIndicador)
  ivaIndicadorDefault?: IvaIndicador;
}

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsEnum(IvaIndicador)
  ivaIndicadorDefault?: IvaIndicador;

  @IsOptional()
  @IsInt()
  orden?: number;
}

/** Actualización masiva de precios de mostrador. */
export class BulkPriceDto {
  /** PORCENTAJE: ajusta ±% sobre el precio actual. FIJO: setea el mismo precio. */
  @IsIn(['PORCENTAJE', 'FIJO'])
  operacion!: 'PORCENTAJE' | 'FIJO';

  @IsNumber()
  valor!: number;

  /** Opcional: acotar a una categoría. */
  @IsOptional()
  @IsString()
  categoriaId?: string;

  /** Opcional: redondear al múltiplo indicado (ej. 1 = entero, 5 = a $5). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  redondear?: number;
}
