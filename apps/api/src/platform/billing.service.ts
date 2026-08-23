import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformInvoiceStatus, Prisma, SubscriptionStatus } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Métricas de facturación del SaaS. */
  async summary() {
    const activos = await this.prisma.subscription.findMany({
      where: { estado: SubscriptionStatus.ACTIVA },
      include: { plan: true },
    });
    const mrr = activos.reduce((s, sub) => s + Number(sub.plan.precioMensual), 0);

    const [pend, venc] = await Promise.all([
      this.prisma.platformInvoice.aggregate({ where: { estado: 'PENDIENTE' }, _sum: { monto: true }, _count: true }),
      this.prisma.platformInvoice.aggregate({ where: { estado: 'VENCIDA' }, _sum: { monto: true }, _count: true }),
    ]);

    return {
      mrr,
      pendiente: { monto: Number(pend._sum.monto ?? 0), cantidad: pend._count },
      vencido: { monto: Number(venc._sum.monto ?? 0), cantidad: venc._count },
    };
  }

  /**
   * Genera las facturas de un período (YYYY-MM) para las suscripciones activas.
   * Idempotente: no duplica si ya existe la del período. Vence el día 10.
   */
  async generatePeriod(periodo: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(periodo);
    if (!m) throw new BadRequestException('Período inválido (formato YYYY-MM)');
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) throw new BadRequestException('Mes inválido');
    const vencimiento = new Date(Date.UTC(year, month - 1, 10));

    const subs = await this.prisma.subscription.findMany({
      where: { estado: { in: [SubscriptionStatus.ACTIVA, SubscriptionStatus.TRIAL] } },
      include: { plan: true },
    });

    let creadas = 0;
    for (const sub of subs) {
      const existe = await this.prisma.platformInvoice.findUnique({
        where: { subscriptionId_periodo: { subscriptionId: sub.id, periodo } },
      });
      if (existe) continue;
      await this.prisma.platformInvoice.create({
        data: {
          subscriptionId: sub.id,
          tenantId: sub.tenantId,
          periodo,
          monto: new Prisma.Decimal(sub.plan.precioMensual),
          vencimiento,
        },
      });
      creadas++;
    }
    return { periodo, suscripciones: subs.length, creadas };
  }

  async list(estado?: string) {
    const invoices = await this.prisma.platformInvoice.findMany({
      where: estado ? { estado: estado as PlatformInvoiceStatus } : undefined,
      orderBy: [{ emitidaAt: 'desc' }],
      include: { tenant: { select: { nombre: true, slug: true } }, subscription: { include: { plan: true } } },
    });
    return invoices.map((i) => ({
      id: i.id,
      tenant: i.tenant.nombre,
      slug: i.tenant.slug,
      plan: i.subscription.plan.code,
      periodo: i.periodo,
      monto: Number(i.monto),
      moneda: i.moneda,
      estado: i.estado,
      vencimiento: i.vencimiento,
      pagadaAt: i.pagadaAt,
    }));
  }

  async markPaid(id: string) {
    const inv = await this.prisma.platformInvoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Factura no encontrada');
    await this.prisma.platformInvoice.update({
      where: { id },
      data: { estado: 'PAGADA', pagadaAt: new Date() },
    });
    // Al pagar, si el tenant estaba suspendido por impago, se reactiva.
    await this.prisma.subscription.updateMany({
      where: { tenantId: inv.tenantId, estado: SubscriptionStatus.SUSPENDIDA },
      data: { estado: SubscriptionStatus.ACTIVA },
    });
    await this.prisma.tenant.update({ where: { id: inv.tenantId }, data: { activo: true } });
    return { id, estado: 'PAGADA' };
  }

  /**
   * Marca como VENCIDA las facturas PENDIENTE pasadas de vencimiento y suspende
   * a esos tenants (suscripción SUSPENDIDA + tenant inactivo). Impago → corte.
   */
  async processOverdue() {
    const vencidas = await this.prisma.platformInvoice.findMany({
      where: { estado: 'PENDIENTE', vencimiento: { lt: new Date() } },
    });
    let suspendidos = 0;
    for (const inv of vencidas) {
      await this.prisma.platformInvoice.update({ where: { id: inv.id }, data: { estado: 'VENCIDA' } });
      await this.prisma.subscription.updateMany({
        where: { tenantId: inv.tenantId, estado: { not: SubscriptionStatus.CANCELADA } },
        data: { estado: SubscriptionStatus.SUSPENDIDA },
      });
      await this.prisma.tenant.update({ where: { id: inv.tenantId }, data: { activo: false } });
      suspendidos++;
    }
    return { vencidas: vencidas.length, suspendidos };
  }
}
