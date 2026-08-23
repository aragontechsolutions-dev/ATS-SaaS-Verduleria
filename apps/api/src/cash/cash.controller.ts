import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { CashService } from './cash.service';
import { CloseCashDto, OpenCashDto } from './cash.dto';

@Controller('cash-sessions')
@UseGuards(TenantGuard, EntitlementsGuard)
@RequiresModule('POS')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Post('open')
  async open(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @Body() dto: OpenCashDto,
  ) {
    return this.cash.open(tenantId, userId, dto);
  }

  @Get('current')
  async current(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
  ) {
    return this.cash.current(tenantId, userId);
  }

  @Get(':id/summary')
  async summary(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.cash.summary(tenantId, id);
  }

  @Post(':id/close')
  async close(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CloseCashDto,
  ) {
    return this.cash.close(tenantId, id, dto);
  }

  @Get(':id')
  async get(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.cash.get(tenantId, id);
  }
}
