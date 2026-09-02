import { IvaIndicador, PromoTipo, UnidadMedida } from '@ats/database';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
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

  /** Visible en la tienda online (e-commerce público). */
  @IsOptional()
  @IsBoolean()
  visibleOnline?: boolean;

  /** Descripción para la ficha de la tienda online. */
  @IsOptional()
  @IsString()
  descripcionOnline?: string;
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

  /** Visible en la tienda online (e-commerce público). */
  @IsOptional()
  @IsBoolean()
  visibleOnline?: boolean;

  /** Descripción para la ficha de la tienda online. '' = quitar. */
  @IsOptional()
  @IsString()
  descripcionOnline?: string;

  /** Proveedor habitual (para el sugerido de compra). '' = quitar. */
  @IsOptional()
  @IsString()
  proveedorId?: string;

  /** Stock mínimo en unidad de venta (dispara reposición). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMinimo?: number;

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

/** Promoción de un producto (2x1, NxM, o N por un precio total). */
export class CreatePromoDto {
  @IsString()
  productId!: string;

  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsEnum(PromoTipo)
  tipo!: PromoTipo;

  /** Cantidad que dispara la promo (N). */
  @IsInt()
  @Min(2)
  llevaN!: number;

  /** NXM: cuántas se pagan (M < N). */
  @IsOptional()
  @IsInt()
  @Min(1)
  pagaM?: number;

  /** CANTIDAD: precio total por llevar N. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioTotal?: number;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdatePromoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsEnum(PromoTipo)
  tipo?: PromoTipo;

  @IsOptional()
  @IsInt()
  @Min(2)
  llevaN?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pagaM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioTotal?: number;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
