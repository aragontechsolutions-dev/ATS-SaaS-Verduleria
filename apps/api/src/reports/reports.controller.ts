import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('POS')
@Roles(Role.ADMIN, Role.ENCARGADO, Role.CONTADOR)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.summary(tenantId, from, to);
  }

  @Get('top-products')
  topProducts(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.topProducts(tenantId, from, to, limit ? Number(limit) : 10);
  }

  @Get('daily')
  daily(@CurrentTenant('tenantId') tenantId: string, @Query('days') days?: string) {
    return this.reports.daily(tenantId, days ? Number(days) : 7);
  }
}
