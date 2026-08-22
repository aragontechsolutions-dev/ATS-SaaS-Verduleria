import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { getTenantContext } from '../tenant/tenant-context';

@Controller('auth')
export class AuthController {
  /**
   * Contexto del usuario autenticado (tenant + rol), resuelto por el
   * TenantMiddleware a partir del token de Supabase. El front lo usa para
   * validar la sesión al arrancar. El login lo hace Supabase Auth directamente.
   */
  @Get('me')
  me(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @CurrentTenant('role') role: string | undefined,
  ) {
    const ctx = getTenantContext();
    if (!ctx?.tenantId) throw new UnauthorizedException();
    return { tenantId, userId, role };
  }
}
