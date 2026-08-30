import { Injectable } from '@nestjs/common';
import { AuditEventTipo, Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant-context';

export interface AuditLogInput {
  tipo: AuditEventTipo;
  descripcion?: string;
  monto?: number;
  refId?: string;
  cashSessionId?: string;
  sucursalId?: string;
  meta?: Record<string, unknown>;
  /** Overrides cuando no hay contexto de request (ej. login). */
  tenantId?: string;
  userId?: string;
  usuario?: string;
}

export interface AuditFilters {
  tipo?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento de auditoría. BEST-EFFORT: cualquier fallo se traga para
   * NO romper la operación principal (una venta no debe fallar por el log).
   */
  async log(input: AuditLogInput): Promise<void> {
    const ctx = getTenantContext();
    const tenantId = input.tenantId ?? ctx?.tenantId;
    if (!tenantId) return;
    try {
      await this.prisma.auditEvent.create({
        data: {
          tenantId,
          userId: input.userId ?? ctx?.userId,
          usuario: input.usuario,
          cashSessionId: input.cashSessionId,
          sucursalId: input.sucursalId,
          tipo: input.tipo,
          descripcion: input.descripcion,
          monto: input.monto != null ? new Prisma.Decimal(input.monto) : undefined,
          refId: input.refId,
          meta: (input.meta as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch {
      /* nunca romper el flujo principal */
    }
  }

  /** Lista eventos con filtros (para el panel de administración). */
  async list(tenantId: string, filtros: AuditFilters) {
    const where: Prisma.AuditEventWhereInput = { tenantId };
    if (filtros.tipo) where.tipo = filtros.tipo as AuditEventTipo;
    if (filtros.userId) where.userId = filtros.userId;
    if (filtros.from || filtros.to) {
      where.createdAt = {
        ...(filtros.from ? { gte: new Date(filtros.from) } : {}),
        ...(filtros.to ? { lte: new Date(`${filtros.to}T23:59:59`) } : {}),
      };
    }
    const take = Math.min(Math.max(filtros.limit ?? 200, 1), 500);
    const rows = await this.prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take });

    // Resolver nombre del usuario (el modelo no tiene relación, se busca aparte).
    const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, email: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      id: r.id,
      fecha: r.createdAt,
      tipo: r.tipo,
      descripcion: r.descripcion,
      monto: r.monto != null ? Number(r.monto) : null,
      usuario: r.usuario ?? (r.userId ? byId.get(r.userId)?.nombre ?? byId.get(r.userId)?.email ?? null : null),
      refId: r.refId,
      meta: r.meta,
    }));
  }
}
