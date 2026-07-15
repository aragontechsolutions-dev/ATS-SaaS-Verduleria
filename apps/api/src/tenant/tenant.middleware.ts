import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { tenantStorage, type TenantContext } from './tenant-context';

/**
 * Resuelve el tenant del request y lo mete en el AsyncLocalStorage.
 *
 * Foundations: toma el tenant de los headers `x-tenant-id` (y opcional
 * `x-user-id` / `x-user-role`). En producción esto se reemplaza por la
 * resolución desde el JWT (custom claim tenant_id) validado por el AuthGuard.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const tenantId = req.header('x-tenant-id');
    if (!tenantId) {
      // Sin tenant: dejamos pasar (rutas públicas/health lo permiten). Los
      // recursos protegidos exigen tenant vía TenantGuard.
      next();
      return;
    }
    const ctx: TenantContext = {
      tenantId,
      userId: req.header('x-user-id') || undefined,
      role: req.header('x-user-role') || undefined,
      emisorRut: req.header('x-emisor-rut') || undefined,
    };
    tenantStorage.run(ctx, () => next());
  }
}
