import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ModuleKey } from '@ats/database';
import { getTenantContext } from '../tenant/tenant-context';
import { REQUIRES_MODULE } from './requires-module.decorator';
import { EntitlementsService } from './entitlements.service';

/**
 * Bloquea el acceso si el plan del tenant no incluye el módulo requerido por el
 * handler/controlador (@RequiresModule). Debe ir DESPUÉS del TenantGuard.
 */
@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ModuleKey | undefined>(REQUIRES_MODULE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true; // handler sin restricción de módulo

    const ctx = getTenantContext();
    if (!ctx?.tenantId) throw new ForbiddenException('Falta el tenant');

    await this.entitlements.assertModule(ctx.tenantId, required);
    return true;
  }
}
