import { Role } from '@ats/database';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsEnum(Role)
  role!: Role;

  /** Contraseña inicial. Si falta, se genera una. */
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
