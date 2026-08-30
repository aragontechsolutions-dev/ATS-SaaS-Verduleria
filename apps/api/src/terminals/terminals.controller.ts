import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { TerminalsService } from './terminals.service';
import { CreateTerminalDto, SetOperadoresDto, UpdateTerminalDto } from './terminals.dto';

/**
 * Cajas físicas (terminales) por sucursal, gestionadas desde el Panel. La
 * gestión (alta/baja/edición/asignación de cajeros) es de ADMIN/ENCARGADO; el
 * listado "mine" lo consume el POS para elegir la caja al abrir turno.
 */
@Controller('terminals')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('POS')
export class TerminalsController {
  constructor(private readonly terminals: TerminalsService) {}

  /** Cajas que el usuario actual puede operar (POS). Debe ir antes de :id. */
  @Get('mine')
  mine(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @CurrentTenant('role') role: string | undefined,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return this.terminals.mine(tenantId, userId, role, sucursalId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  list(@CurrentTenant('tenantId') tenantId: string) {
    return this.terminals.list(tenantId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  create(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateTerminalDto) {
    return this.terminals.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  update(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateTerminalDto) {
    return this.terminals.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  remove(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.terminals.remove(tenantId, id);
  }

  @Put(':id/operadores')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  setOperadores(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SetOperadoresDto,
  ) {
    return this.terminals.setOperadores(tenantId, id, dto);
  }
}
