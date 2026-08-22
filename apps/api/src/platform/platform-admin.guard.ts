import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { getTenantContext } from '../tenant/tenant-context';

/** Exige que el usuario autenticado sea super-admin de la plataforma (Aragon). */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const ctx = getTenantContext();
    if (!ctx?.userId) throw new ForbiddenException('No autenticado');
    if (!ctx.isPlatformAdmin) throw new ForbiddenException('Requiere permisos de plataforma');
    return true;
  }
}
