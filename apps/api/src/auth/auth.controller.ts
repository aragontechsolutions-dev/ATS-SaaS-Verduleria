import { Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { getTenantContext } from '../tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Contexto del usuario autenticado (tenant + rol), resuelto por el
   * TenantMiddleware a partir del token de Supabase. El front lo usa para
   * validar la sesión al arrancar (un usuario inactivo no resuelve contexto y
   * recibe 401 acá). Incluye `mustChangePassword` para forzar el cambio de la
   * contraseña temporal en el primer acceso.
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
