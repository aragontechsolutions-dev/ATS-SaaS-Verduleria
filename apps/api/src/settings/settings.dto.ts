import { RegimenFiscal } from '@ats/database';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsEnum(RegimenFiscal)
  regimenFiscal?: RegimenFiscal;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  email?: string;

  /** Límite de efectivo en el cajón (0 o vacío = sin límite). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteEfectivoCaja?: number;

  // --- Facturación electrónica (CFE) ---
  @IsOptional()
  @IsString()
  cfeAmbiente?: 'test' | 'produccion';

  @IsOptional()
  @IsString()
  emisorRut?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sucursalDefault?: number;
}
