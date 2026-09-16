import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { RemitosService } from './remitos.service';
import { CrearRemitoDto, SetEstadoRemitoDto } from './remitos.dto';

/** Remitos de traslado (no fiscales) para venta mayorista. Requiere WHOLESALE. */
@Controller('remitos')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('WHOLESALE')
@Roles(Role.ADMIN, Role.ENCARGADO, Role.DEPOSITO)
export class RemitosController {
  constructor(private readonly remitos: RemitosService) {}

  @Get()
  listar(@CurrentTenant('tenantId') tenantId: string, @Query('limit') limit?: string) {
    return this.remitos.listar(tenantId, limit ? Number(limit) : undefined);
  }

  @Post()
  crear(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CrearRemitoDto) {
    return this.remitos.crear(tenantId, dto);
  }

  @Get(':id')
  get(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.remitos.get(tenantId, id);
  }

  @Post(':id/estado')
  setEstado(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: SetEstadoRemitoDto) {
    return this.remitos.setEstado(tenantId, id, dto.estado);
  }
}
