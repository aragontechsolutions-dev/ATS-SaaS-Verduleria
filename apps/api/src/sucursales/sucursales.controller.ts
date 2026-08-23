import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { SucursalesService } from './sucursales.service';
import { CreateSucursalDto, TransferStockDto, UpdateSucursalDto } from './sucursales.dto';

/**
 * Sucursales del tenant. Listar y renombrar la sucursal está disponible para
 * cualquier plan (todos tienen al menos una); crear una segunda o transferir
 * stock exige el módulo MULTI_SUCURSAL.
 */
@Controller('sucursales')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
export class SucursalesController {
  constructor(private readonly sucursales: SucursalesService) {}

  /** Disponible para todos los roles: alimenta los selectores de sucursal. */
  @Get()
  list(@CurrentTenant('tenantId') tenantId: string) {
    return this.sucursales.list(tenantId);
  }

  @Post()
  @RequiresModule('MULTI_SUCURSAL')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  create(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateSucursalDto) {
    return this.sucursales.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  update(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSucursalDto,
  ) {
    return this.sucursales.update(tenantId, id, dto);
  }

  @Post('transfer')
  @RequiresModule('MULTI_SUCURSAL')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.DEPOSITO)
  transfer(@CurrentTenant('tenantId') tenantId: string, @Body() dto: TransferStockDto) {
    return this.sucursales.transfer(tenantId, dto);
  }
}
