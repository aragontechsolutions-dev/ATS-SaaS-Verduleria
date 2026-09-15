import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { PricingService } from './pricing.service';
import { CrearListaDto, GuardarPreciosDto, PreciosMasivoDto } from './pricing.dto';

/** Listas de precios (mayoristas y por cliente) — requiere el módulo PRICING. */
@Controller('pricing')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('PRICING')
@Roles(Role.ADMIN, Role.ENCARGADO)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('listas')
  listas(@CurrentTenant('tenantId') tenantId: string) {
    return this.pricing.listas(tenantId);
  }

  @Post('listas')
  crearLista(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CrearListaDto) {
    return this.pricing.crearLista(tenantId, dto);
  }

  @Get('listas/:id/precios')
  precios(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.pricing.precios(tenantId, id);
  }

  @Put('listas/:id/precios')
  guardar(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: GuardarPreciosDto) {
    return this.pricing.guardarPrecios(tenantId, id, dto);
  }

  @Post('listas/:id/precios/masivo')
  masivo(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: PreciosMasivoDto) {
    return this.pricing.masivo(tenantId, id, dto);
  }
}
