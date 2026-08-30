import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './audit.dto';

@Controller('audit')
@UseGuards(TenantGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Bitácora del tenant (para el panel). Lectura: ADMIN/ENCARGADO/CONTADOR. */
  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CONTADOR)
  list(
    @CurrentTenant('tenantId') tenantId: string,
    @Query('tipo') tipo?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(tenantId, { tipo, userId, from, to, limit: limit ? Number(limit) : undefined });
  }

  /** Eventos emitidos por el POS (cajón, anulación de línea, cambio de precio). */
  @Post()
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  create(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateAuditDto) {
    return this.audit.log({ ...dto, tenantId });
  }
}
