import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { getTenantContext } from '../tenant/tenant-context';
import { ActividadService } from './actividad.service';

function parseDevice(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return 'TABLET';
  if (/mobi|android|iphone|ipod|windows phone/.test(s)) return 'MOVIL';
  if (!s) return 'OTRO';
  return 'ESCRITORIO';
}

function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) return raw.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

/**
 * Registra (throttled) qué tenant/usuario usó qué app y desde qué dispositivo.
 * Fire-and-forget al entrar la request: nunca bloquea ni rompe la respuesta.
 * Ignora al super-admin de plataforma (no monitoreamos nuestra propia Consola).
 */
@Injectable()
export class ActividadInterceptor implements NestInterceptor {
  constructor(private readonly actividad: ActividadService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    try {
      const ctx = getTenantContext();
      if (ctx?.tenantId && ctx.userId && !ctx.isPlatformAdmin) {
        const req = context.switchToHttp().getRequest<Request>();
        const app = String(req.headers['x-app'] ?? '').toLowerCase() || 'otros';
        const ua = String(req.headers['user-agent'] ?? '');
        void this.actividad.registrar({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          app,
          deviceType: parseDevice(ua),
          ip: clientIp(req),
          userAgent: ua,
        });
      }
    } catch {
      /* la telemetría nunca debe romper un request */
    }
    return next.handle();
  }
}
