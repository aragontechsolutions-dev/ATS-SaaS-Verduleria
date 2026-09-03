import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72) // límite de bcrypt
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

export class AddressDto {
  @IsString()
  @MaxLength(40)
  etiqueta!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  direccion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referencia?: string;
}
