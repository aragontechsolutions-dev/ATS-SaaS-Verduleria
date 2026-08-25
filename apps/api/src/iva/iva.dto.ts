import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

const INDICADORES = ['EXENTO', 'MINIMA', 'BASICA', 'SUSPENSO'] as const;
type Indicador = (typeof INDICADORES)[number];

export class CreateIvaRuleDto {
  @IsString()
  @MinLength(2)
  termino!: string;

  @IsIn(INDICADORES)
  ivaIndicador!: Indicador;

  @IsOptional()
  @IsBoolean()
  esEstadoNatural?: boolean;

  @IsOptional()
  @IsBoolean()
  esImportado?: boolean;

  @IsOptional()
  @IsInt()
  prioridad?: number;

  @IsOptional()
  @IsString()
  nota?: string;
}

export class UpdateIvaRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  termino?: string;

  @IsOptional()
  @IsIn(INDICADORES)
  ivaIndicador?: Indicador;

  @IsOptional()
  @IsBoolean()
  esEstadoNatural?: boolean;

  @IsOptional()
  @IsBoolean()
  esImportado?: boolean;

  @IsOptional()
  @IsInt()
  prioridad?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  nota?: string;
}

export class ClasificarDto {
  @IsString()
  @MinLength(1)
  nombre!: string;
}
