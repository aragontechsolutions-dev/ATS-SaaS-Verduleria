import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- Proveedores ------------------------------------------------------------

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  /** Consignatario / mayorista de la UAM (Mercado Modelo). */
  @IsOptional()
  @IsBoolean()
  esUam?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  esUam?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// --- Compras ----------------------------------------------------------------

export class PurchaseItemDto {
  @IsString()
  productId!: string;

  /** Cantidad comprada en la unidad de compra del producto (ej: 3 cajones). */
  @IsNumber()
  @Min(0.001)
  cantidadCompra!: number;

  /** Costo por unidad de compra (ej: precio de un cajón). */
  @IsNumber()
  @Min(0)
  costoUnitCompra!: number;

  /**
   * Peso/rinde real recibido en unidad de venta (kg/unidades). Si se omite se
   * calcula como cantidadCompra × factorConversion del producto.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  rindeVenta?: number;
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  /** Fecha de la compra (ISO). Por defecto, ahora. */
  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}

// --- Ajuste de stock --------------------------------------------------------

export class StockAdjustDto {
  @IsString()
  productId!: string;

  /** Diferencia a aplicar sobre el stock actual (+ suma, − resta). */
  @IsNumber()
  cantidad!: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

// --- Merma ------------------------------------------------------------------

export class CreateWasteDto {
  @IsString()
  productId!: string;

  /** Cantidad descartada en unidad de venta (kg/unidades). */
  @IsNumber()
  @Min(0.001)
  cantidad!: number;

  /** pudrición, golpe, remarque, descarte… */
  @IsOptional()
  @IsString()
  motivo?: string;
}

export class ListQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}
