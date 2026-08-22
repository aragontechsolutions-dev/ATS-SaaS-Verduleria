import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { EntitlementsService } from './entitlements.service';
import { MODULE_CATALOG } from './module-catalog';

@Controller('me')
@UseGuards(TenantGuard)
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /**
   * Derechos del tenant actual: plan, estado, módulos activos (con su metadata)
   * y límites. La UI (POS/panel) usa esto para mostrar/ocultar secciones.
   */
  @Get('entitlements')
  async getEntitlements(@CurrentTenant('tenantId') tenantId: string) {
    const ent = await this.entitlements.resolve(tenantId);
    return {
      ...ent,
      modules: ent.modules.map((key) => MODULE_CATALOG[key]),
    };
  }
}
