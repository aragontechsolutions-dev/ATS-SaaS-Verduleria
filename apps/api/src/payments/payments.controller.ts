import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequiresModule } from '../entitlements/requires-module.decorator';
import { PaymentsService } from './payments.service';
import { RegistrarPagoDto } from './payments.dto';

@Controller('pagos')
@UseGuards(TenantGuard, EntitlementsGuard, RolesGuard)
@RequiresModule('POS')
@Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Carga a mano un pago cobrado por una vía no integrada (Getnet/Handy/transferencia…). */
  @Post()
  registrar(@CurrentTenant('tenantId') tenantId: string, @Body() dto: RegistrarPagoDto) {
    return this.payments.registrarPago(tenantId, dto);
  }

  /** Lista pagos de una venta (?saleId=) o un pedido (?onlineOrderId=). */
  @Get()
  listar(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('saleId') saleId?: string,
    @Query('onlineOrderId') onlineOrderId?: string,
  ) {
    return this.payments.listar(tenantId, { saleId, onlineOrderId });
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  eliminar(@CurrentTenant('tenantId') tenantId: string, @Param('id') id: string) {
    return this.payments.eliminar(tenantId, id);
  }
}
