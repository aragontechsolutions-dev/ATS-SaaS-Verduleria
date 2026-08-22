import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
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
