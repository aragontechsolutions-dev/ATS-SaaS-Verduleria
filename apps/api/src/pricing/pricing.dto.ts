import { IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoListaPrecio } from '@ats/database';

export class CrearListaDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEnum(TipoListaPrecio)
  tipo!: TipoListaPrecio;
}

export class PrecioItemDto {
  @IsString()
  productId!: string;

  /** Precio NETO (sin IVA) para esta lista. */
  @IsNumber()
  precio!: number;
}

export class GuardarPreciosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrecioItemDto)
  items!: PrecioItemDto[];
}

export class PreciosMasivoDto {
  /** margenCosto: neto = costo × (1 + valor%); descuentoMostrador: neto = mostrador × (1 − valor%);
   *  igualMostrador: neto = mostrador. */
  @IsIn(['margenCosto', 'descuentoMostrador', 'igualMostrador'])
  modo!: 'margenCosto' | 'descuentoMostrador' | 'igualMostrador';

  @IsOptional()
  @IsNumber()
  valor?: number;

  /** Si se pasa, solo aplica a esa categoría. */
  @IsOptional()
  @IsString()
  categoriaId?: string;

  /** Si true, solo completa los productos sin precio en la lista (no pisa los cargados). */
  @IsOptional()
  soloVacios?: boolean;
}
