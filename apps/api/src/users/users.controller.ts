import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@ats/database';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../tenant/roles.guard';
import { Roles } from '../tenant/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

/** Gestión de usuarios del tenant (empleados). Solo el ADMIN de la verdulería. */
@Controller('users')
@UseGuards(TenantGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentTenant('tenantId') tenantId: string) {
    return this.users.list(tenantId);
  }

  @Post()
  create(@CurrentTenant('tenantId') tenantId: string, @Body() dto: CreateUserDto) {
    return this.users.create(tenantId, dto);
  }

  @Patch(':membershipId')
  update(
    @CurrentTenant('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(tenantId, membershipId, dto);
  }
}
