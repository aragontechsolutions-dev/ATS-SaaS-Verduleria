import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSucursalDto {
  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsOptional()
  @IsString()
  direccion?: string;
}

export class UpdateSucursalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Transferencia de stock de una sucursal a otra. */
export class TransferStockDto {
  @IsString()
  productId!: string;

  @IsString()
  fromSucursalId!: string;

  @IsString()
  toSucursalId!: string;

  @IsNumber()
  @Min(0.001)
  cantidad!: number;
}
