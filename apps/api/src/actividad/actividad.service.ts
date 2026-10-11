import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Apps cliente que reportamos (el resto cae en "otros"). */
const APPS = new Set(['admin', 'pos', 'repartidor', 'comprador']);

export interface RegistroActividad {
  tenantId: string;
  userId?: string;
  app: string;
  deviceType: string;
  ip?: string;
  userAgent?: string;
}

/** Cada cuánto, como máximo, escribimos una fila de actividad (por combinación). */
const THROTTLE_MS = 5 * 60 * 1000;

@Injectable()
export class ActividadService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly ultimo = new Map<string, number>();

  /** Registra actividad de forma throttled (no escribe en cada request). */
  async registrar(r: RegistroActividad): Promise<void> {
    if (!r.userId) return;
    const app = APPS.has(r.app) ? r.app : 'otros';
    const key = `${r.tenantId}|${r.userId}|${app}|${r.deviceType}`;
    const now = Date.now();
    const prev = this.ultimo.get(key) ?? 0;
    if (now - prev < THROTTLE_MS) return;
    this.ultimo.set(key, now);
    try {
      await this.prisma.deviceActivity.upsert({
        where: { tenantId_userId_app_deviceType: { tenantId: r.tenantId, userId: r.userId, app, deviceType: r.deviceType } },
        update: { lastSeenAt: new Date(), ip: r.ip ?? undefined, userAgent: r.userAgent?.slice(0, 400) ?? undefined, visitas: { increment: 1 } },
        create: { tenantId: r.tenantId, userId: r.userId, app, deviceType: r.deviceType, ip: r.ip, userAgent: r.userAgent?.slice(0, 400) },
      });
    } catch {
      /* la telemetría nunca debe romper un request */
    }
  }

  /** Resumen por tenant para la Consola (última actividad, apps, dispositivos). */
  async resumen() {
    const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [tenants, acts] = await Promise.all([
      this.prisma.tenant.findMany({ select: { id: true, nombre: true, slug: true, activo: true } }),
      this.prisma.deviceActivity.findMany({ where: { lastSeenAt: { gte: desde } }, orderBy: { lastSeenAt: 'desc' } }),
    ]);
    const porTenant = new Map<string, typeof acts>();
    for (const a of acts) {
      const arr = porTenant.get(a.tenantId) ?? [];
      arr.push(a);
      porTenant.set(a.tenantId, arr);
    }
    return tenants.map((t) => {
      const rows = porTenant.get(t.id) ?? [];
      const lastSeenAt = rows[0]?.lastSeenAt ?? null;
      const apps = [...new Set(rows.map((r) => r.app))];
      const usuarios = new Set(rows.map((r) => r.userId).filter(Boolean)).size;
      const dispositivos = rows.length;
      const ultimaIp = rows[0]?.ip ?? null;
      return {
        tenantId: t.id,
        nombre: t.nombre,
        slug: t.slug,
        activo: t.activo,
        lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
        apps,
        usuarios,
        dispositivos,
        ultimaIp,
      };
    }).sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));
  }

  /** Detalle de actividad de un tenant (filas por usuario/app/dispositivo). */
  async detalle(tenantId: string) {
    const rows = await this.prisma.deviceActivity.findMany({
      where: { tenantId },
      orderBy: { lastSeenAt: 'desc' },
      take: 200,
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, nombre: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = r.userId ? byId.get(r.userId) : undefined;
      return {
        usuario: u?.nombre ?? u?.email ?? '—',
        email: u?.email ?? null,
        app: r.app,
        deviceType: r.deviceType,
        ip: r.ip,
        visitas: r.visitas,
        firstSeenAt: r.firstSeenAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
      };
    });
  }
}
