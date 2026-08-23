import { Injectable } from '@nestjs/common';
import { SaleStatus } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';

/** Rango [from, to] inclusive por día. Si falta, usa el día de hoy. */
function parseRange(from?: string, to?: string): { gte: Date; lt: Date } {
  const start = from ? new Date(from) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date(from ?? Date.now());
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1); // fin de día → exclusivo al día siguiente
  return { gte: start, lt: end };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resumen de ventas: total, cantidad, ticket promedio y desglose por medio. */
  async summary(tenantId: string, from?: string, to?: string) {
    const fecha = parseRange(from, to);
    const where = { tenantId, status: SaleStatus.COMPLETADA, fecha };

    const [agg, porMedioRaw] = await Promise.all([
      this.prisma.sale.aggregate({ where, _sum: { total: true, ivaTotal: true }, _count: true }),
      this.prisma.payment.groupBy({
        by: ['medio'],
        where: { tenantId, sale: { is: where } },
        _sum: { monto: true },
      }),
    ]);

    const totalVendido = Number(agg._sum.total ?? 0);
    const ventas = agg._count;
    return {
      desde: fecha.gte.toISOString(),
      ventas,
      totalVendido,
      ivaTotal: Number(agg._sum.ivaTotal ?? 0),
      ticketPromedio: ventas > 0 ? totalVendido / ventas : 0,
      porMedio: porMedioRaw.map((p) => ({ medio: p.medio, monto: Number(p._sum.monto ?? 0) })),
    };
  }

  /** Top productos por monto vendido en el rango. */
  async topProducts(tenantId: string, from?: string, to?: string, limit = 10) {
    const fecha = parseRange(from, to);
    const grouped = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: { tenantId, sale: { is: { status: SaleStatus.COMPLETADA, fecha } } },
      _sum: { total: true, cantidad: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const ids = grouped.map((g) => g.productId).filter((x): x is string => !!x);
    const productos = ids.length
      ? await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
      : [];
    const nombreById = new Map(productos.map((p) => [p.id, p.nombre]));

    return grouped.map((g) => ({
      productId: g.productId,
      nombre: g.productId ? (nombreById.get(g.productId) ?? 'Producto') : 'Vario',
      monto: Number(g._sum.total ?? 0),
      cantidad: Number(g._sum.cantidad ?? 0),
    }));
  }

  /** Ventas por día en los últimos N días (para el gráfico). */
  async daily(tenantId: string, days = 7) {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const endExcl = new Date(end);
    endExcl.setDate(endExcl.getDate() + 1);

    const sales = await this.prisma.sale.findMany({
      where: { tenantId, status: SaleStatus.COMPLETADA, fecha: { gte: start, lt: endExcl } },
      select: { fecha: true, total: true },
    });

    // Inicializar todos los días en 0 y sumar.
    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const s of sales) {
      const key = s.fecha.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(s.total));
    }
    return [...buckets.entries()].map(([dia, total]) => ({ dia, total }));
  }
}
