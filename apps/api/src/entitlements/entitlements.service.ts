import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ModuleKey, SubscriptionStatus } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';

/** Límites efectivos de un tenant (null = ilimitado). */
export interface EntitlementLimits {
  maxUsuarios: number | null;
  maxSucursales: number | null;
  maxProductos: number | null;
  maxDispositivosPos: number | null;
}

export interface Entitlements {
  planCode: string | null;
  planNombre: string | null;
  estado: SubscriptionStatus | 'SIN_SUSCRIPCION';
  activa: boolean;
  modules: ModuleKey[];
  limits: EntitlementLimits;
}

const SIN_MODULOS: EntitlementLimits = {
  maxUsuarios: null,
  maxSucursales: null,
  maxProductos: null,
  maxDispositivosPos: null,
};

type LimitKey = keyof EntitlementLimits;

/**
 * Resuelve los derechos (módulos + límites) de un tenant a partir de su
 * suscripción y el plan, aplicando overrides. Cachea por tenant con TTL corto;
 * invalidar con `invalidate(tenantId)` al cambiar la suscripción.
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly cache = new Map<string, { value: Entitlements; expiresAt: number }>();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  async resolve(tenantId: string): Promise<Entitlements> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    let value: Entitlements;
    if (!sub) {
      value = {
        planCode: null,
        planNombre: null,
        estado: 'SIN_SUSCRIPCION',
        activa: false,
        modules: [],
        limits: SIN_MODULOS,
      };
    } else {
      const activa = sub.estado === SubscriptionStatus.ACTIVA || sub.estado === SubscriptionStatus.TRIAL;
      // Módulos efectivos = (plan ∪ extra) − excluidos. Solo si la sub está activa.
      const set = new Set<ModuleKey>(activa ? sub.plan.modules : []);
      if (activa) for (const m of sub.modulosExtra) set.add(m);
      for (const m of sub.modulosExcluidos) set.delete(m);

      value = {
        planCode: sub.plan.code,
        planNombre: sub.plan.nombre,
        estado: sub.estado,
        activa,
        modules: [...set],
        limits: {
          maxUsuarios: sub.overrideMaxUsuarios ?? sub.plan.maxUsuarios ?? null,
          maxSucursales: sub.overrideMaxSucursales ?? sub.plan.maxSucursales ?? null,
          maxProductos: sub.overrideMaxProductos ?? sub.plan.maxProductos ?? null,
          maxDispositivosPos: sub.overrideMaxDispositivosPos ?? sub.plan.maxDispositivosPos ?? null,
        },
      };
    }

    this.cache.set(tenantId, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  async hasModule(tenantId: string, module: ModuleKey): Promise<boolean> {
    const ent = await this.resolve(tenantId);
    return ent.modules.includes(module);
  }

  /** Lanza ForbiddenException si el tenant no tiene el módulo. */
  async assertModule(tenantId: string, module: ModuleKey): Promise<void> {
    if (!(await this.hasModule(tenantId, module))) {
      throw new ForbiddenException(`Tu plan no incluye el módulo "${module}".`);
    }
  }

  /**
   * Verifica un límite antes de crear un recurso. `cantidadActual` es el conteo
   * existente; se puede crear si actual + 1 <= límite (o si es ilimitado).
   */
  async assertWithinLimit(tenantId: string, limit: LimitKey, cantidadActual: number): Promise<void> {
    const ent = await this.resolve(tenantId);
    const max = ent.limits[limit];
    if (max !== null && cantidadActual + 1 > max) {
      throw new ForbiddenException(`Alcanzaste el límite de tu plan para "${limit}" (${max}).`);
    }
  }
}
