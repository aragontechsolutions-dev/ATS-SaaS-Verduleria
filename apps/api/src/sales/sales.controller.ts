import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { SalesService } from './sales.service';
import { CreateDevolucionDto, CreateSaleDto } from './sales.dto';

@Controller('sales')
@UseGuards(TenantGuard, EntitlementsGuard)
@RequiresModule('POS')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  /** Crea una venta (idempotente por idempotencyKey). Usado por el sync del POS. */
  @Post()
  async create(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateSaleDto) {
    return this.sales.createSale(tenantId, dto);
  }

  /** Crea una devolución (nota de crédito) de una venta. Idempotente. */
  @Post('devoluciones')
  async devolucion(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateDevolucionDto) {
    return this.sales.createDevolucion(tenantId, dto);
  }

  @Get(':id')
  async getOne(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.sales.getSale(tenantId, id);
  }
}
