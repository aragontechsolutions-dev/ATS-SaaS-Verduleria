import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { PaymentsPointService } from './payments.point.service';

export class CobrarPointDto {
  @IsNumber()
  @Min(0.01)
  monto!: number;

  /** Referencia externa (ej. id de la venta/sesión). */
  @IsOptional()
  @IsString()
  referencia?: string;
}

/** Cobro presencial con lector Mercado Pago Point (lo usa el POS). */
@Controller('point')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('POS')
@Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
export class PaymentsPointController {
  constructor(private readonly point: PaymentsPointService) {}

  /** ¿Hay lector configurado? (para mostrar u ocultar el botón en el POS) */
  @Get('estado')
  estado(@CurrentTenant('tenantId') tenantId: string) {
    return this.point.estado(tenantId);
  }

  /** Envía un cobro al lector. Devuelve el id de la intención para hacer seguimiento. */
  @Post('cobrar')
  cobrar(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CobrarPointDto) {
    return this.point.cobrar(tenantId, dto.monto, dto.referencia?.trim() || `pos-${Date.now()}`);
  }

  /** Estado de una intención de cobro (el POS lo consulta hasta que finalice). */
  @Get('intent/:id')
  estadoIntent(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.point.estadoIntent(tenantId, id);
  }

  /** Cancela un cobro pendiente en el lector. */
  @Post('intent/:id/cancelar')
  cancelar(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.point.cancelar(tenantId, id);
  }
}
