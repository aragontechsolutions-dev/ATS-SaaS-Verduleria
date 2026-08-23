import { IvaIndicador, UnidadMedida } from '@ats/database';
import {
  IsBoolean,
  IsEnum,
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
