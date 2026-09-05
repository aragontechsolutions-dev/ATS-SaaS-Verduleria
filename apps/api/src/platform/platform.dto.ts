import { CertificadoEstado, RegimenFiscal } from '@ats/database';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

/** Alta de un cliente nuevo (verdulería) = tenant + su admin + suscripción. */
export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  nombre!: string; // nombre comercial

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug: solo minúsculas, números y guiones' })
  slug!: string;

  @IsString()
  planCode!: string; // "BASICO" | "PRO" | "FULL"

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(2)
  adminNombre!: string;

  /** Contraseña inicial del admin del cliente. Si falta, se genera una. */
  @IsOptional()
  @IsString()
  @MinLength(6)
  adminPassword?: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;
}

/** Cambios sobre un tenant existente (activar/suspender, cambiar de plan). */
export class UpdateTenantDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  planCode?: string;
}

/**
 * Config fiscal (CFE) del tenant. Se edita SOLO desde la Consola (Aragon); el
 * panel del tenant la ve en modo lectura. El proveedor y cod_montos_brutos se
 * derivan del régimen (no se piden). Activar la emisión en producción exige el
 * checklist (confirmarProduccion + certificado vigente + RUT emisor).
 */
export class UpdateCfeConfigDto {
  @IsOptional()
  @IsEnum(RegimenFiscal)
  regimenFiscal?: RegimenFiscal;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsString()
  emisorRut?: string;

  @IsOptional()
  @IsIn(['test', 'produccion'])
  ambiente?: 'test' | 'produccion';

  @IsOptional()
  @IsInt()
  @Min(1)
  sucursalDefault?: number;

  @IsOptional()
  @IsBoolean()
  emisionActiva?: boolean;

  @IsOptional()
  @IsEnum(CertificadoEstado)
  certificadoEstado?: CertificadoEstado;

  /** Confirmación explícita del checklist para prender la emisión en producción. */
  @IsOptional()
  @IsBoolean()
  confirmarProduccion?: boolean;
}
