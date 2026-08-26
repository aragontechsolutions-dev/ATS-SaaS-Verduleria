import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { CashService } from './cash.service';
import { CashMovementDto, CloseCashDto, OpenCashDto } from './cash.dto';

@Controller('cash-sessions')
@UseGuards(TenantGuard, EntitlementsGuard)
@RequiresModule('POS')
export class CashController {
  constructor(private readonly cash: CashService) {}

  /** Feed histórico + en vivo de operaciones de caja (Panel). Debe ir antes de :id. */
  @Get('operations')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CONTADOR)
  async operations(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return this.cash.operations(tenantId, { from, to, userId, sucursalId });
  }

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

  /** Registra un ingreso/egreso de efectivo del turno (no venta). */
  @Post(':id/movements')
  async addMovement(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @Param('id') id: string,
    @Body() dto: CashMovementDto,
  ) {
    return this.cash.addMovement(tenantId, userId, id, dto);
  }

  @Get(':id/movements')
  async movements(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.cash.listMovements(tenantId, id);
  }

  @Get(':id')
  async get(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.cash.get(tenantId, id);
  }
}
