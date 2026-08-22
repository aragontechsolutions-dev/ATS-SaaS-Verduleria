import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/configuration';
import { AuthService } from '../auth/auth.service';
import { tenantStorage, type TenantContext } from './tenant-context';

/**
 * Resuelve el tenant del request y lo mete en el AsyncLocalStorage.
 *
 * Producción: verifica el access token de Supabase (Authorization: Bearer) y
 * resuelve el tenant/rol desde nuestra base. Esta es la vía segura.
 *
 * Dev/testing: si `ALLOW_HEADER_TENANT=true`, admite además los headers
 * `x-tenant-id` / `x-user-id` / `x-user-role`. En producción queda apagado, así
 * que nadie puede suplantar el tenant por header.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const resolved = await this.auth.authenticate(authHeader.slice(7).trim());
        tenantStorage.run(this.toContext(resolved), () => next());
        return;
      } catch {
        // Token inválido/no habilitado: seguimos sin contexto → guards 401/403.
        next();
        return;
      }
    }

    // Dev/testing: resolvemos por email (misma lógica que Supabase) para poder
    // probar sin tokens. Solo si ALLOW_HEADER_TENANT=true.
    const allowHeader = this.config.get('auth', { infer: true }).allowHeaderTenant;
    const email = allowHeader ? req.header('x-user-email') : undefined;
    if (!email) {
      next();
      return;
    }
    try {
      const resolved = await this.auth.resolveContext({ id: '', email });
      tenantStorage.run(this.toContext(resolved), () => next());
    } catch {
      next();
    }
  }

  private toContext(resolved: {
    tenantId: string;
    userId: string;
    role: string;
    emisorRut?: string;
    isPlatformAdmin: boolean;
  }): TenantContext {
    return {
      tenantId: resolved.tenantId,
      userId: resolved.userId,
      role: resolved.role,
      emisorRut: resolved.emisorRut,
      isPlatformAdmin: resolved.isPlatformAdmin,
    };
  }
}
