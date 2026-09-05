import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { RepartoService } from './reparto.service';
import { LocalUbicacionDto, PresenciaDto } from './reparto.dto';

/** PWA del repartidor. Requiere usuario con rol REPARTIDOR. */
@Controller('reparto')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.REPARTIDOR)
export class RepartidorController {
  constructor(private readonly reparto: RepartoService) {}

  /** Heartbeat de presencia + ubicación (DISPONIBLE / OFFLINE). */
  @Post('presencia')
  presencia(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string,
    @Body() dto: PresenciaDto,
  ) {
    return this.reparto.presencia(tenantId, userId, dto);
  }

  @Get('mis-pedidos')
  misPedidos(@CurrentTenant('tenantId') tenantId: string, @CurrentTenant('userId') userId: string) {
    return this.reparto.misPedidos(tenantId, userId);
  }

  @Post('pedidos/:id/en-camino')
  enCamino(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.reparto.marcarEnCamino(tenantId, userId, id);
  }

  @Post('pedidos/:id/entregado')
  entregado(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.reparto.marcarEntregado(tenantId, userId, id);
  }
}

/** Panel del negocio: despacho y panorama de reparto. */
@Controller('store/reparto')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ENCARGADO)
export class RepartoAdminController {
  constructor(private readonly reparto: RepartoService) {}

  @Get('estado')
  estado(@CurrentTenant('tenantId') tenantId: string) {
    return this.reparto.estado(tenantId);
  }

  @Put('local')
  setLocal(@CurrentTenant('tenantId') tenantId: string, @Body() dto: LocalUbicacionDto) {
    return this.reparto.setLocal(tenantId, dto);
  }

  @Post('pedidos/:id/despachar')
  despachar(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.reparto.despachar(tenantId, id);
  }
}
