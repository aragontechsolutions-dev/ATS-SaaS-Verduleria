import { Body, Controller, Get, HttpException, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { getTenantContext } from '../tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';

/** Intentos fallidos consecutivos antes de bloquear al usuario. */
export const MAX_LOGIN_ATTEMPTS = 3;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Login mediado por el backend: valida contra Supabase (password grant) y
   * lleva el conteo de intentos fallidos. Tras 3 fallos, bloquea al usuario
   * (lo desbloquea un admin). Devuelve los tokens de Supabase; el cliente los
   * setea en su sesión. Endpoint público (sin token todavía).
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, bloqueado: true, failedLoginAttempts: true, isPlatformAdmin: true },
    });

    if (user?.bloqueado) {
      throw new HttpException(
        { code: 'LOCKED', message: 'Usuario bloqueado por intentos fallidos. Pedí que te desbloqueen.' },
        HttpStatus.LOCKED,
      );
    }

    const tokens = await this.auth.passwordGrant(email, dto.password);

    if (!tokens) {
      let remaining: number | null = null;
      let locked = false;
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        // El dueño de plataforma no se bloquea (no habría quién lo desbloquee).
        locked = attempts >= MAX_LOGIN_ATTEMPTS && !user.isPlatformAdmin;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: attempts, bloqueado: locked ? true : undefined },
        });
        remaining = user.isPlatformAdmin ? null : Math.max(0, MAX_LOGIN_ATTEMPTS - attempts);
      }
      throw new HttpException(
        locked
          ? { code: 'LOCKED', message: 'Usuario bloqueado por 3 intentos fallidos. Pedí que te desbloqueen.' }
          : { code: 'BAD_CREDENTIALS', message: 'Credenciales inválidas', remaining },
        locked ? HttpStatus.LOCKED : HttpStatus.UNAUTHORIZED,
      );
    }

    // Éxito: resetea el contador de fallos.
    if (user && user.failedLoginAttempts > 0) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0 } });
    }
    return tokens;
  }

  /**
   * Contexto del usuario autenticado (tenant + rol). Un usuario inactivo no
   * resuelve contexto y recibe 401 acá. Incluye `mustChangePassword`.
   */
  @Get('me')
  async me(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @CurrentTenant('role') role: string | undefined,
  ) {
    const ctx = getTenantContext();
    if (!ctx?.tenantId || !userId) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nombre: true, mustChangePassword: true },
    });
    return { tenantId, userId, role, nombre: user?.nombre ?? null, mustChangePassword: user?.mustChangePassword ?? false };
  }

  /**
   * Marca que el usuario ya cambió su contraseña temporal (limpia el flag de
   * primer acceso). Lo llama el POS tras un cambio exitoso, antes de re-loguear.
   */
  @Post('password-changed')
  async passwordChanged(@CurrentTenant('userId') userId: string | undefined) {
    const ctx = getTenantContext();
    if (!ctx?.tenantId || !userId) throw new UnauthorizedException();
    await this.prisma.user.update({ where: { id: userId }, data: { mustChangePassword: false } });
    return { ok: true };
  }
}
