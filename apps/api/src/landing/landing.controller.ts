import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { LandingService } from './landing.service';
import { SaveLandingDto } from './landing.dto';

/** Edición de la landing — solo el ADMIN del tenant. */
@Controller('landing')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.ADMIN)
export class LandingController {
  constructor(private readonly landing: LandingService) {}

  @Get()
  get(@CurrentTenant('tenantId') tenantId: string) {
    return this.landing.getForAdmin(tenantId);
  }

  @Put()
  save(@CurrentTenant('tenantId') tenantId: string, @Body() dto: SaveLandingDto) {
    return this.landing.saveDraft(tenantId, dto.config);
  }

  @Post('publish')
  publish(@CurrentTenant('tenantId') tenantId: string) {
    return this.landing.publish(tenantId);
  }

  @Post('unpublish')
  unpublish(@CurrentTenant('tenantId') tenantId: string) {
    return this.landing.unpublish(tenantId);
  }
}

/** Vista pública por slug — SIN autenticación (la consume la página pública). */
@Controller('public/landing')
export class PublicLandingController {
  constructor(private readonly landing: LandingService) {}

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.landing.getPublic(slug);
  }
}
