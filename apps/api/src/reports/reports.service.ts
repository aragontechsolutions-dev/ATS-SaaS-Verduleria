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

  /**
   * Rentabilidad del rango: ingresos, costo de mercadería, ganancia bruta y
   * margen, más el detalle por producto. Usa el costo real capturado en cada
   * venta (SaleItem.costoUnit). Los ítems sin costo (productos que no se
   * controlan en stock) se excluyen del costo y se reportan como "cobertura"
   * para no inflar el margen.
   */
  async profit(tenantId: string, from?: string, to?: string, limit = 50) {
    const fecha = parseRange(from, to);
    const items = await this.prisma.saleItem.findMany({
      where: { tenantId, sale: { is: { status: SaleStatus.COMPLETADA, fecha } } },
      select: {
        productId: true,
        concepto: true,
        cantidad: true,
        total: true,
        costoUnit: true,
        product: { select: { nombre: true } },
      },
    });

    let ingresos = 0;
    let ingresosConCosto = 0;
    let costo = 0;

    type Row = {
      productId: string | null;
      nombre: string;
      ingresos: number; // total vendido (con y sin costo)
      ingresosConCosto: number; // solo lo que tiene costo, base del margen
      costo: number;
      cantidad: number;
    };
    const byProduct = new Map<string, Row>();

    for (const it of items) {
      const lineTotal = Number(it.total);
      const cant = Number(it.cantidad);
      const tieneCosto = it.costoUnit != null;
      const lineCost = tieneCosto ? Number(it.costoUnit) * cant : 0;

      ingresos += lineTotal;
      if (tieneCosto) {
        ingresosConCosto += lineTotal;
        costo += lineCost;
      }

      const key = it.productId ?? `c:${it.concepto}`;
      const nombre = it.product?.nombre ?? it.concepto;
      const row = byProduct.get(key) ?? { productId: it.productId, nombre, ingresos: 0, ingresosConCosto: 0, costo: 0, cantidad: 0 };
      row.ingresos += lineTotal;
      row.cantidad += cant;
      if (tieneCosto) {
        row.ingresosConCosto += lineTotal;
        row.costo += lineCost;
      }
      byProduct.set(key, row);
    }

    const ganancia = ingresosConCosto - costo;
    const round = (n: number) => Number(n.toFixed(2));

    // Ganancia y margen siempre sobre la base con costo (para que reconcilie con
    // el total); `parcial` avisa si el producto tuvo ventas sin costo cargado.
    const productos = [...byProduct.values()]
      .map((r) => {
        const conCosto = r.ingresosConCosto > 0;
        const gan = r.ingresosConCosto - r.costo;
        return {
          productId: r.productId,
          nombre: r.nombre,
          cantidad: Number(r.cantidad.toFixed(3)),
          ingresos: round(r.ingresos),
          costo: round(r.costo),
          ganancia: conCosto ? round(gan) : null,
          margenPct: conCosto ? Number(((gan / r.ingresosConCosto) * 100).toFixed(1)) : null,
          parcial: conCosto && r.ingresosConCosto < r.ingresos - 0.005,
        };
      })
      .sort((a, b) => (b.ganancia ?? -1) - (a.ganancia ?? -1))
      .slice(0, limit);

    return {
      desde: fecha.gte.toISOString(),
      ingresos: round(ingresos),
      costo: round(costo),
      ganancia: round(ganancia),
      margenPct: ingresosConCosto > 0 ? Number(((ganancia / ingresosConCosto) * 100).toFixed(1)) : null,
      coberturaPct: ingresos > 0 ? Number(((ingresosConCosto / ingresos) * 100).toFixed(1)) : null,
      ingresosSinCosto: round(ingresos - ingresosConCosto),
      productos,
    };
  }

  /** Ventas por categoría de producto en el rango (monto y cantidad). */
  async byCategory(tenantId: string, from?: string, to?: string) {
    const fecha = parseRange(from, to);
    const items = await this.prisma.saleItem.findMany({
      where: { tenantId, sale: { is: { status: SaleStatus.COMPLETADA, fecha } } },
      select: {
        total: true,
        cantidad: true,
        product: { select: { categoriaId: true, categoria: { select: { nombre: true } } } },
      },
    });

    type Row = { categoriaId: string | null; nombre: string; monto: number; cantidad: number };
    const byCat = new Map<string, Row>();
    for (const it of items) {
      const catId = it.product?.categoriaId ?? null;
      const nombre = it.product?.categoria?.nombre ?? 'Sin categoría';
      const key = catId ?? 'sin';
      const row = byCat.get(key) ?? { categoriaId: catId, nombre, monto: 0, cantidad: 0 };
      row.monto += Number(it.total);
      row.cantidad += Number(it.cantidad);
      byCat.set(key, row);
    }

    return [...byCat.values()]
      .map((r) => ({ ...r, monto: Number(r.monto.toFixed(2)), cantidad: Number(r.cantidad.toFixed(3)) }))
      .sort((a, b) => b.monto - a.monto);
  }

  /**
   * Ventas por hora del día (0–23) en el rango, en hora de Uruguay (UTC−3, sin
   * horario de verano). Devuelve las 24 horas para poder graficar la curva.
   */
  async byHour(tenantId: string, from?: string, to?: string) {
    const fecha = parseRange(from, to);
    const sales = await this.prisma.sale.findMany({
      where: { tenantId, status: SaleStatus.COMPLETADA, fecha },
      select: { fecha: true, total: true },
    });

    const buckets = Array.from({ length: 24 }, (_, hora) => ({ hora, ventas: 0, total: 0 }));
    for (const s of sales) {
      const horaUY = (s.fecha.getUTCHours() - 3 + 24) % 24; // Uruguay = UTC−3
      buckets[horaUY].ventas += 1;
      buckets[horaUY].total += Number(s.total);
    }
    return buckets.map((b) => ({ ...b, total: Number(b.total.toFixed(2)) }));
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
