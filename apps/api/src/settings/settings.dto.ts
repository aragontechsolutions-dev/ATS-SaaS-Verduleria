import { RegimenFiscal } from '@ats/database';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

  // --- Fidelización ---
  @IsOptional()
  @IsBoolean()
  loyaltyActivo?: boolean;

  /** Pesos de compra por punto (ej. 100 = 1 punto cada $100). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyAcumulaCada?: number;

  /** Valor en $ de un punto al canjear. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyValorPunto?: number;

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
