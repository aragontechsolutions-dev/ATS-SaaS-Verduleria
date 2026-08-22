import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { getTenantContext } from '../tenant/tenant-context';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Login público: email + contraseña → JWT. */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  /**
   * Datos del usuario/tenant del token actual. Sirve para que el front valide el
   * token al arrancar. El contexto lo puebla el TenantMiddleware desde el JWT.
   */
  @Get('me')
  async me(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @CurrentTenant('role') role: string | undefined,
  ) {
    const ctx = getTenantContext();
    if (!ctx?.tenantId) throw new UnauthorizedException();
    return { tenantId, userId, role };
  }
}
