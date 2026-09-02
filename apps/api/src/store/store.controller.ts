import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { StoreService } from './store.service';
import { CreateOrderDto, CreateZoneDto, SaveStoreConfigDto, UpdateZoneDto } from './store.dto';

/** Tienda online pública por slug — SIN autenticación (la consume la web pública). */
@Controller('public/tienda')
export class PublicStoreController {
  constructor(private readonly store: StoreService) {}

  @Get(':slug/catalogo')
  catalogo(@Param('slug') slug: string) {
    return this.store.getPublicCatalog(slug);
  }

  @Post(':slug/pedido')
  crearPedido(@Param('slug') slug: string, @Body() dto: CreateOrderDto) {
    return this.store.createOrder(slug, dto);
  }

  @Get(':slug/pedido/:codigo')
  seguirPedido(@Param('slug') slug: string, @Param('codigo') codigo: string) {
    return this.store.getOrderByCodigo(slug, codigo);
  }
}

/** Gestión de la tienda (config + zonas) — solo el ADMIN del tenant. */
@Controller('store')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StoreAdminController {
  constructor(private readonly store: StoreService) {}

  @Get('config')
  getConfig(@CurrentTenant('tenantId') tenantId: string) {
    return this.store.getConfig(tenantId);
  }

  @Put('config')
  saveConfig(@CurrentTenant('tenantId') tenantId: string, @Body() dto: SaveStoreConfigDto) {
    return this.store.saveConfig(tenantId, dto);
  }

  @Post('zonas')
  createZone(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateZoneDto) {
    return this.store.createZone(tenantId, dto);
  }

  @Patch('zonas/:id')
  updateZone(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.store.updateZone(tenantId, id, dto);
  }

  @Delete('zonas/:id')
  deleteZone(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.store.deleteZone(tenantId, id);
  }
}
