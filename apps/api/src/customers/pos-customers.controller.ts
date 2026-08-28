import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { CustomersService } from './customers.service';
import { CobranzaDto, QuickCustomerDto } from './customers.dto';

/**
 * Identificación fiscal del comprador desde el POS. A diferencia del módulo de
 * clientes mayoristas (cuenta corriente, gated por WHOLESALE), esto es una
 * capacidad fiscal base: cualquier tenant que emite CFE necesita poder
 * identificar al comprador (e-Factura con RUC, o e-Ticket > 5.000 UI). Por eso
 * NO exige el módulo WHOLESALE y lo puede usar el CAJERO.
 */
@Controller('pos/customers')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO, Role.CONTADOR)
export class PosCustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Busca clientes por nombre / documento / razón social (para el POS). */
  @Get('search')
  search(@CurrentTenant('tenantId') tenantId: string, @Query('q') q?: string) {
    return this.customers.search(tenantId, q);
  }

  /** Alta rápida de comprador (solo datos fiscales). */
  @Post()
  quick(@CurrentTenant('tenantId') tenantId: string, @Body() dto: QuickCustomerDto) {
    return this.customers.quickCreate(tenantId, dto);
  }

  /** Clientes con deuda (saldo > 0), para cobrar. */
  @Get('deudores')
  deudores(@CurrentTenant('tenantId') tenantId: string, @Query('q') q?: string) {
    return this.customers.deudores(tenantId, q);
  }

  /** Registra una cobranza de cuenta corriente (baja saldo; ingresa efectivo a caja). */
  @Post(':id/cobranza')
  cobranza(
    @CurrentTenant('tenantId') tenantId: string,
    @CurrentTenant('userId') userId: string | undefined,
    @Param('id') id: string,
    @Body() dto: CobranzaDto,
  ) {
    return this.customers.cobranza(tenantId, id, dto, userId);
  }
}
