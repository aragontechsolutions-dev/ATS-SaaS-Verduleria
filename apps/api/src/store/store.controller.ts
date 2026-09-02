import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { OnlineOrderEstado, Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { StoreService } from './store.service';
import {
  CreateOrderDto,
  CreateZoneDto,
  PesajeDto,
  SaveStoreConfigDto,
  SetEstadoDto,
  UpdateZoneDto,
} from './store.dto';

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

/** Webhook entrante de Telegram — SIN autenticación (valida un secreto en la ruta). */
@Controller('public/telegram')
export class TelegramWebhookController {
  constructor(private readonly store: StoreService) {}

  @Post(':secret')
  webhook(@Param('secret') secret: string, @Body() update: unknown) {
    return this.store.handleTelegramWebhook(secret, update);
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

  // --- Pedidos --------------------------------------------------------------

  @Get('pedidos')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  listOrders(@CurrentTenant('tenantId') tenantId: string, @Query('estado') estado?: string) {
    const e = estado && estado in OnlineOrderEstado ? (estado as OnlineOrderEstado) : undefined;
    return this.store.listOrders(tenantId, e);
  }

  @Get('pedidos/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  getOrder(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.store.getOrderAdmin(tenantId, id);
  }

  @Patch('pedidos/:id/estado')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  setEstado(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: SetEstadoDto) {
    return this.store.setEstado(tenantId, id, dto);
  }

  @Patch('pedidos/:id/pesaje')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  pesaje(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: PesajeDto) {
    return this.store.pesaje(tenantId, id, dto);
  }

  // --- Telegram -------------------------------------------------------------

  @Post('telegram/link')
  telegramLink(@CurrentTenant('tenantId') tenantId: string) {
    return this.store.telegramLink(tenantId);
  }

  @Post('telegram/test')
  telegramTest(@CurrentTenant('tenantId') tenantId: string) {
    return this.store.telegramTest(tenantId);
  }

  @Delete('telegram')
  telegramUnlink(@CurrentTenant('tenantId') tenantId: string) {
    return this.store.telegramUnlink(tenantId);
  }
}
