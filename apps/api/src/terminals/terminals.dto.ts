import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTerminalDto {
  @IsUUID()
  sucursalId!: string;

  @IsString()
  @MinLength(1)
  nombre!: string;
}

export class UpdateTerminalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Reemplaza el conjunto de cajeros habilitados para operar la caja. */
export class SetOperadoresDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds!: string[];
}
