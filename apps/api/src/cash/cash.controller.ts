import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { CashService } from './cash.service';
import { CashMovementDto, CloseCashDto, OpenCashDto, RelevoDto } from './cash.dto';

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
    @Query('terminalId') terminalId?: string,
  ) {
    return this.cash.operations(tenantId, { from, to, userId, sucursalId, terminalId });
  }

  /** Arqueos por turno de caja (reporte por caja). Debe ir antes de :id. */
  @Get('arqueos')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CONTADOR)
  async arqueos(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('terminalId') terminalId?: string,
  ) {
    return this.cash.arqueos(tenantId, { from, to, userId, sucursalId, terminalId });
  }

  @Post('open')
  async open(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @CurrentTenant('role') role: string | undefined,
    @Body() dto: OpenCashDto,
  ) {
    return this.cash.open(tenantId, userId, role, dto);
  }

  /** Relevo de cajero: cierra el turno del saliente y abre el del entrante. */
  @Post('relevo')
  async relevo(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @CurrentTenant('role') role: string | undefined,
    @Body() dto: RelevoDto,
  ) {
    return this.cash.relevo(tenantId, userId, role, dto);
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

  /** Corte X (caja abierta) o Z (caja cerrada) del turno. */
  @Get(':id/corte')
  async corte(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.cash.corte(tenantId, id);
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
