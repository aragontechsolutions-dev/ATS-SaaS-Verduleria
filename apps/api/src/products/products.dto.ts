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

  /**
   * IVA. Normalmente lo asigna solo el motor de IVA por el nombre; solo se
   * envía si el contador hace override manual (junto con ivaOverride=true).
   */
  @IsOptional()
  @IsEnum(IvaIndicador)
  ivaIndicador?: IvaIndicador;

  /** true = el contador fijó el IVA a mano; el motor no lo reclasifica. */
  @IsOptional()
  @IsBoolean()
  ivaOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  esEstadoNatural?: boolean;

  @IsOptional()
  @IsBoolean()
  esImportado?: boolean;

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

  @IsOptional()
  @IsString()
  imagenUrl?: string;
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

  /** true = override del contador; false = volver a que lo asigne el motor. */
  @IsOptional()
  @IsBoolean()
  ivaOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  esEstadoNatural?: boolean;

  @IsOptional()
  @IsBoolean()
  esImportado?: boolean;

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
  @IsString()
  imagenUrl?: string;

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
