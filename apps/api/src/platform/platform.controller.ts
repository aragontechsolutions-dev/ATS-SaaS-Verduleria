import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformService } from './platform.service';
import { CreateTenantDto, UpdateCfeConfigDto, UpdateTenantDto } from './platform.dto';

/** Consola de plataforma (Aragon). Todo exige ser super-admin de plataforma. */
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('overview')
  overview() {
    return this.platform.overview();
  }

  @Get('plans')
  plans() {
    return this.platform.listPlans();
  }

  @Get('tenants')
  listTenants() {
    return this.platform.listTenants();
  }

  /** Usuarios bloqueados por intentos fallidos (para desbloquear al admin). */
  @Get('locked-users')
  lockedUsers() {
    return this.platform.lockedUsers();
  }

  @Post('users/:id/unlock')
  unlockUser(@Param('id') id: string) {
    return this.platform.unlockUser(id);
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.platform.createTenant(dto);
  }

  @Patch('tenants/:id')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.platform.updateTenant(id, dto);
  }

  /** Config fiscal (CFE) del tenant — lectura. */
  @Get('tenants/:id/cfe')
  getCfeConfig(@Param('id') id: string) {
    return this.platform.getCfeConfig(id);
  }

  /** Config fiscal (CFE) del tenant — edición (solo Aragon). */
  @Patch('tenants/:id/cfe')
  updateCfeConfig(@Param('id') id: string, @Body() dto: UpdateCfeConfigDto) {
    return this.platform.updateCfeConfig(id, dto);
  }
}
