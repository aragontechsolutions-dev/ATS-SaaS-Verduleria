import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(TenantGuard, EntitlementsGuard)
@RequiresModule('POS')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async get(@CurrentTenant('tenantId') tenantId: string) {
    return this.catalog.getCatalog(tenantId);
  }
}
