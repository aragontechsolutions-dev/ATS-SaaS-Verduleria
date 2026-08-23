import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@ats/database';
import { getTenantContext } from './tenant-context';
import { ROLES_KEY } from './roles.decorator';

/**
 * Restringe el acceso a los roles listados en @Roles(). Los super-admins de
 * plataforma pasan siempre (soporte). Debe ir después del TenantGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const ctx = getTenantContext();
    if (ctx?.isPlatformAdmin) return true;
    if (!ctx?.role || !roles.includes(ctx.role as Role)) {
      throw new ForbiddenException('No tenés permisos para esta acción');
    }
    return true;
  }
}
