import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './settings.dto';

/** Configuración de la verdulería: datos fiscales + CFE. Solo ADMIN. */
@Controller('settings')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentTenant('tenantId') tenantId: string) {
    return this.settings.get(tenantId);
  }

  @Patch()
  update(@CurrentTenant('tenantId') tenantId: string, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(tenantId, dto);
  }
}
