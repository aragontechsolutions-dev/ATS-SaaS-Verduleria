import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

/** Conectar / actualizar las credenciales de Mercado Pago del tenant. */
export class ConectarMpDto {
  /** Access Token de Mercado Pago (TEST-… en sandbox, APP_USR-… en producción). */
  @IsString()
  @MinLength(20)
  accessToken!: string;

  /** Public Key de MP (opcional; se usa en el front para el Brick, Parte 2). */
  @IsOptional()
  @IsString()
  publicKey?: string;
}

export class ActivarCobroDto {
  @IsBoolean()
  activo!: boolean;
}
