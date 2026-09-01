import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, ChargeDto, PaymentDto, UpdateCustomerDto } from './customers.dto';

/**
 * Clientes mayoristas y su cuenta corriente (fiado B2B). Requiere el módulo
 * WHOLESALE. Gestión para ADMIN/ENCARGADO; cobranzas también el CAJERO;
 * lectura además para el CONTADOR.
 */
@Controller('customers')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('WHOLESALE')
@Roles(Role.ADMIN, Role.ENCARGADO, Role.CONTADOR)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentTenant('tenantId') tenantId: string, @Query('todos') todos?: string) {
    return this.customers.list(tenantId, todos !== 'true');
  }

  @Post()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  create(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateCustomerDto) {
    return this.customers.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  update(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(tenantId, id, dto);
  }

  @Get(':id/account')
  account(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.customers.account(tenantId, id);
  }

  @Post(':id/payments')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  addPayment(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: PaymentDto) {
    return this.customers.addPayment(tenantId, id, dto);
  }

  @Post(':id/charges')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  addCharge(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string, @Body() dto: ChargeDto) {
    return this.customers.addCharge(tenantId, id, dto);
  }

  /** Puntos de fidelización: saldo + movimientos del cliente. */
  @Get(':id/loyalty')
  loyalty(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.customers.loyalty(tenantId, id);
  }

  /** Ajuste manual de puntos (regalo / corrección). */
  @Post(':id/loyalty/ajuste')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  ajustePuntos(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: { puntos: number; descripcion?: string },
  ) {
    return this.customers.ajustarPuntos(tenantId, id, Number(body.puntos), body.descripcion);
  }
}
