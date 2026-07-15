import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { getTenantContext } from './tenant-context';

/** Exige que exista un tenant resuelto en el contexto del request. */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const ctx = getTenantContext();
    if (!ctx?.tenantId) {
      throw new ForbiddenException('Falta el tenant (header x-tenant-id o JWT)');
    }
    return true;
  }
}
