import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { PaymentsConfigService } from './payments.config.service';
import { ActivarCobroDto, ConectarMpDto } from './payments.config.dto';

/**
 * Config de cobro online (Mercado Pago) del tenant. Solo ADMIN: son
 * credenciales sensibles y el dinero va a la cuenta MP del comercio.
 */
@Controller('pagos/config')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PaymentsConfigController {
  constructor(private readonly cfg: PaymentsConfigService) {}

  @Get()
  ver(@CurrentTenant('tenantId') tenantId: string) {
    return this.cfg.ver(tenantId);
  }

  @Put()
  conectar(@CurrentTenant('tenantId') tenantId: string, @Body() dto: ConectarMpDto) {
    return this.cfg.conectar(tenantId, dto);
  }

  @Post('probar')
  probar(@CurrentTenant('tenantId') tenantId: string) {
    return this.cfg.probar(tenantId);
  }

  @Post('activar')
  activar(@CurrentTenant('tenantId') tenantId: string, @Body() dto: ActivarCobroDto) {
    return this.cfg.activar(tenantId, dto);
  }

  @Delete()
  desconectar(@CurrentTenant('tenantId') tenantId: string) {
    return this.cfg.desconectar(tenantId);
  }
}
