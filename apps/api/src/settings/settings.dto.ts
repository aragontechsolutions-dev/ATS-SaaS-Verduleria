import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';

// NOTA: la config FISCAL (RUT, régimen, ambiente, emisión, sucursal) NO se edita
// desde el panel del tenant — se gestiona en la Consola de Aragon
// (PATCH /platform/tenants/:id/cfe). Acá solo van datos comerciales y de caja.
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

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

  // --- Tienda online ---
  /** Activa la tienda online (e-commerce público) del tenant. */
  @IsOptional()
  @IsBoolean()
  tiendaOnlineActiva?: boolean;

  // --- Seguridad de caja (PIN de supervisor) ---
  /** Nuevo PIN (4-12 dígitos). Se hashea en el servidor. */
  @IsOptional()
  @IsString()
  @Length(4, 12)
  cajaPin?: string;

  /** Quitar el PIN (y desactivar todas las puertas). */
  @IsOptional()
  @IsBoolean()
  cajaPinClear?: boolean;

  /** Qué acciones exigen PIN: { discount, price, void, return }. */
  @IsOptional()
  @IsObject()
  cajaGates?: Record<string, boolean>;
}
