import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { RemitoEstado } from '@ats/database';

export class RemitoItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(1)
  concepto!: string;

  @IsNumber()
  @Min(0.001)
  cantidad!: number;

  @IsString()
  unidad!: string;
}

export class CrearRemitoDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  /** Si no se pasa customerId, el nombre del cliente es obligatorio. */
  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @IsOptional()
  @IsString()
  transportista?: string;

  @IsOptional()
  @IsString()
  matricula?: string;

  @IsOptional()
  @IsString()
  destino?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RemitoItemDto)
  items!: RemitoItemDto[];
}

export class SetEstadoRemitoDto {
  @IsEnum(RemitoEstado)
  estado!: RemitoEstado;
}
